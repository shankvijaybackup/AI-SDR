import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import twilio from "twilio";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

// ========== GLOBAL ERROR HANDLERS - PREVENT CRASHES ==========
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - keep server running
});

import {
  initCall,
  updateCall,
  addTranscript,
  getCall,
  listCalls
} from "./callState.js";
import { createOutboundCall } from "./twilioClient.js";
import { getAiSdrReply, summarizeCall } from "./openaiClient.js";
import { attachMediaStreamServer } from "./mediaStreamServer.js";
import { attachRealtimeVoiceServer } from "./realtimeVoiceServer.js";
import { voiceRealtimeWebhook } from "./routes/voice-realtime.js";
import { voiceMediaStreamWebhook } from "./routes/voice-media-stream.js";
import { initiateCall, getActiveCall, updateCallTranscript, endCall } from "./routes/initiate-call.js";
import { synthesizeWithChatterbox as chatterboxSynthesize, healthCheck as chatterboxHealth } from "./chatterboxClient.js";
import { startCampaign, handleCallComplete, controlCampaign } from "./services/bulkCallManager.js";

const app = express();

const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const ELEVEN_VOICE_ID_MALE = process.env.ELEVEN_VOICE_ID_MALE;
const ELEVEN_VOICE_ID_FEMALE = process.env.ELEVEN_VOICE_ID_FEMALE;
const USE_CHATTERBOX = process.env.USE_CHATTERBOX === "true";
const CHATTERBOX_VOICE_MALE = process.env.CHATTERBOX_VOICE_MALE || "alex";
const CHATTERBOX_VOICE_FEMALE = process.env.CHATTERBOX_VOICE_FEMALE || "sarah";
const TTS_DIR = path.join(process.cwd(), "tts_files");

// Voice selection: use voice from call metadata (set during initiation)
const callVoiceMap = new Map();

function getVoiceIdForCall(callSid) {
  // First check if voice was set in call metadata
  if (callVoiceMap.has(callSid)) {
    return callVoiceMap.get(callSid);
  }

  // Fallback to legacy alternating logic (shouldn't happen with new system)
  console.warn(`[Voice] No voice found for callSid ${callSid}, using fallback`);
  const useFemaleVoice = callVoiceMap.size % 2 === 0;
  let voiceId;
  if (USE_CHATTERBOX) {
    voiceId = useFemaleVoice ? CHATTERBOX_VOICE_FEMALE : CHATTERBOX_VOICE_MALE;
  } else {
    voiceId = useFemaleVoice ? ELEVEN_VOICE_ID_FEMALE : ELEVEN_VOICE_ID_MALE;
  }
  callVoiceMap.set(callSid, voiceId);
  return voiceId;
}

// Export function to set voice for a call (called from initiate-call.js)
export function setVoiceForCall(callSid, voiceId) {
  callVoiceMap.set(callSid, voiceId);
  console.log(`[Voice] Set voice ${voiceId} for call ${callSid}`);
}

if (!fs.existsSync(TTS_DIR)) {
  fs.mkdirSync(TTS_DIR, { recursive: true });
  console.log("✅ Created TTS directory:", TTS_DIR);
}

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  })
);

// Twilio sends x-www-form-urlencoded to webhooks
app.use("/api/twilio", bodyParser.urlencoded({ extended: false }));
// Frontend sends JSON
app.use(bodyParser.json());

// Serve synthesized TTS files so Twilio can <Play> them
app.use("/tts", express.static(TTS_DIR));

// Import Persona Service
import { generateCompanyPersona } from "./services/personaService.js";

// ---------- PERSONA GENERATION ROUTE ----------
app.post("/api/knowledge/persona", async (req, res) => {
  try {
    const { url, companyName, existingKnowledge } = req.body;
    if (!url || !companyName) {
      return res.status(400).json({ error: "Missing url or companyName" });
    }

    if (existingKnowledge) {
      console.log(`[API] Received ${existingKnowledge.length} chars of existing knowledge`);
    }

    // Call the multi-AI service with optional existing knowledge
    const persona = await generateCompanyPersona(url, companyName, existingKnowledge);

    res.json({ persona });
  } catch (err) {
    console.error("[API] Persona generation failed:", err);
    res.status(500).json({ error: "Failed to generate persona", details: err.message });
  }
});

// ---------- ElevenLabs TTS Helper ----------

// Timeout wrapper for async operations
function withTimeout(promise, ms, errorMsg = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
}

// Truncate text to prevent long TTS calls
function truncateForTTS(text, maxLength = 200) {
  if (text.length <= maxLength) return text;
  // Find last sentence boundary before maxLength
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastBoundary = Math.max(lastPeriod, lastQuestion, lastExclaim);
  if (lastBoundary > 50) {
    return text.substring(0, lastBoundary + 1);
  }
  return truncated + '...';
}

export async function synthesizeWithElevenLabs(text, callSid) {
  if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID_MALE || !ELEVEN_VOICE_ID_FEMALE || !PUBLIC_BASE_URL) {
    throw new Error("Missing ElevenLabs env vars or PUBLIC_BASE_URL.");
  }

  // Truncate long text to prevent slow TTS
  const truncatedText = truncateForTTS(text, 150); // Reduced from 180 for faster TTS

  const voiceId = getVoiceIdForCall(callSid);
  const voiceType = voiceId === ELEVEN_VOICE_ID_FEMALE ? "Female" : "Male";
  console.log(`[ElevenLabs] Synthesizing (${voiceType}) for ${callSid}:`, truncatedText.substring(0, 50) + '...');

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced from 8s for faster fallback

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text: truncatedText,
        model_id: "eleven_turbo_v2_5", // Faster model
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ElevenLabs] Error:", res.status, errText);
      throw new Error(`ElevenLabs TTS failed: ${res.status}`);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    const id = randomUUID();
    const filename = `${id}.mp3`;
    const filepath = path.join(TTS_DIR, filename);

    await fs.promises.writeFile(filepath, audioBuffer);

    const publicUrl = `${PUBLIC_BASE_URL}/tts/${filename}`;
    console.log("[ElevenLabs] Audio ready at:", publicUrl);
    return publicUrl;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error('[ElevenLabs] Request timed out');
      throw new Error('ElevenLabs TTS timed out');
    }
    throw err;
  }
}

// ---------- Chatterbox TTS Helper ----------

export async function synthesizeWithChatterboxTTS(text, callSid) {
  if (!PUBLIC_BASE_URL) {
    throw new Error("Missing PUBLIC_BASE_URL.");
  }

  const voiceId = getVoiceIdForCall(callSid);
  const voiceType = voiceId === CHATTERBOX_VOICE_FEMALE ? "Female" : "Male";
  console.log(`[Chatterbox] Synthesizing (${voiceType}) for ${callSid}:`, text);

  const audioBuffer = await chatterboxSynthesize(text, voiceId, {
    exaggeration: 0.5,
    cfg_weight: 0.5,
    output_format: "mp3"
  });

  const id = randomUUID();
  const filename = `${id}.mp3`;
  const filepath = path.join(TTS_DIR, filename);

  await fs.promises.writeFile(filepath, Buffer.from(audioBuffer));

  const publicUrl = `${PUBLIC_BASE_URL}/tts/${filename}`;
  console.log("[Chatterbox] Audio ready at:", publicUrl);
  return publicUrl;
}

// ---------- Unified TTS Helper (Auto-switch) ----------
// Use ElevenLabs or Chatterbox based on env config
export async function synthesizeTTS(text, callSid) {
  if (USE_CHATTERBOX) {
    return await synthesizeWithChatterboxTTS(text, callSid);
  } else {
    return await synthesizeWithElevenLabs(text, callSid);
  }
}

// ---------- Helper: simple script registry in-memory ----------
const scripts = new Map();
let scriptCounter = 1;

function createScript({ script, leadName, companyName }) {
  const id = String(scriptCounter++);
  scripts.set(id, { script, leadName, companyName });
  return id;
}

function getScript(scriptId) {
  return scripts.get(scriptId) || null;
}

// ---------- Public API: start outbound calls ----------

app.post("/api/calls/start", async (req, res) => {
  try {
    const { numbers, script, leadName, companyName } = req.body || {};

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res
        .status(400)
        .json({ error: "numbers must be a non-empty array" });
    }

    const scriptId = createScript({ script: script || "", leadName, companyName });

    const results = [];
    for (const raw of numbers) {
      const to = raw && String(raw).trim();
      if (!to) continue;

      const call = await createOutboundCall({ to, scriptId });
      initCall(call.sid, {
        script,
        leadName,
        companyName
      });
      results.push({
        callSid: call.sid,
        to: call.to,
        status: call.status
      });
    }

    res.json({ ok: true, scriptId, calls: results });
  } catch (err) {
    console.error("Error /api/calls/start:", err);
    res.status(500).json({ error: "Failed to start calls" });
  }
});

// ---------- Public API: list / get call state ----------

app.get("/api/calls", (req, res) => {
  res.json({ calls: listCalls() });
});

app.get("/api/calls/:callSid", (req, res) => {
  const call = getCall(req.params.callSid);
  if (!call) {
    return res.status(404).json({ error: "Call not found" });
  }
  res.json({ call });
});

// ---------- Twilio Voice webhook: Enhanced Speech Model ----------

// Media Stream voice webhook (optimized latency)
app.post("/api/twilio/voice-media-stream", voiceMediaStreamWebhook);

// Realtime API voice webhook (experimental - not working yet)
app.post("/api/twilio/voice-realtime", voiceRealtimeWebhook);

// Traditional voice webhook (working but slower)
app.post("/api/twilio/voice", async (req, res) => {
  console.log(
    "➡️  /api/twilio/voice hit. CallSid:",
    req.body.CallSid,
    "callId:",
    req.query.callId
  );

  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;
  const callId = req.query.callId;
  const customScript = req.query.script ? decodeURIComponent(req.query.script) : null;
  const voicePersona = req.query.voicePersona || 'female';

  // Bridge metadata from the initiation request into call state (lead email, userId, region)
  const activeCall = callId ? getActiveCall(callId) : null;

  // Extract first line/sentence from script as opening greeting
  // MUST include a proper greeting with "How are you?" 
  let openingScript = "Hi, this is Alex from Atomicwork. How are you doing today?";
  if (customScript) {
    // Take the first TWO sentences to ensure we get the "How are you?" part
    // Split on sentence boundaries but keep delimiters
    const sentences = customScript.match(/[^.!?]+[.!?]+/g) || [customScript];
    if (sentences.length >= 2) {
      // Take first two sentences
      openingScript = sentences.slice(0, 2).join(' ').trim();
    } else if (sentences.length === 1 && sentences[0].length > 10) {
      openingScript = sentences[0].trim();
    }
    // Ensure it's not too long for TTS (max 200 chars)
    if (openingScript.length > 200) {
      openingScript = openingScript.substring(0, 200);
    }
  }

  initCall(callSid, {
    script: (activeCall && activeCall.script) ? activeCall.script : (customScript || "Default sales script"),
    leadName: (activeCall && activeCall.leadName) ? activeCall.leadName : (req.query.leadName || "there"),
    companyName: "",
    userId: (activeCall && activeCall.userId) ? activeCall.userId : null
  });
  updateCall(callSid, { status: "in-progress" });

  if (activeCall) {
    updateCall(callSid, {
      leadEmail: activeCall.leadEmail || null,
      leadRegion: activeCall.region || null
    });
  }

  console.log(`[Script] Using opening: ${openingScript.substring(0, 80)}...`);

  // Play greeting with TTS (ElevenLabs with Polly fallback)
  try {
    const audioUrl = await synthesizeTTS(openingScript, callSid);
    console.log(`[Greeting] Playing: ${audioUrl}`);
    twiml.play(audioUrl);
  } catch (err) {
    console.error("[Greeting] TTS failed, using Polly:", err.message);
    twiml.say({ voice: "Polly.Joanna" }, openingScript);
  }

  twiml.pause({ length: 0.15 }); // Reduced from 0.2 for faster response

  // Gather with Enhanced Speech Model for better accuracy
  twiml.gather({
    input: "speech",
    action: "/api/twilio/handle-speech",
    method: "POST",
    timeout: 10, // Reduced from 12 for snappier response
    speechTimeout: "auto",
    speechModel: "phone_call",  // Enhanced model for phone calls
    enhanced: true,              // Enable enhanced speech recognition
    profanityFilter: false,
    language: "en-US"
  });

  // If no speech is captured, Twilio continues to the next verb.
  // Redirect back to handle-speech so we can reprompt without replaying the greeting.
  twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");

  res.type("text/xml");
  res.send(twiml.toString());
});

// ---------- Twilio Voice webhook: handle user speech ----------

app.post("/api/twilio/handle-speech", async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const callSid = req.body.CallSid;
    const speechResult = req.body.SpeechResult || "";
    const confidence = req.body.Confidence;

    console.log(
      "➡️  /api/twilio/handle-speech hit. CallSid:",
      callSid,
      "Speech:",
      speechResult.substring(0, 50),
      "Confidence:",
      confidence
    );

    const call = getCall(callSid);
    if (!call) {
      console.error("[handle-speech] Call not found:", callSid);
      twiml.say({ voice: "Polly.Joanna" }, "Sorry, let me call you back. Bye!");
      twiml.hangup();
      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // If Twilio posts back with no speech (silence/timeout), reprompt + listen again.
    if (!String(speechResult || "").trim()) {
      twiml.say({ voice: "Polly.Joanna" }, "Are you still there?");

      twiml.gather({
        input: "speech",
        action: "/api/twilio/handle-speech",
        method: "POST",
        timeout: 10,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });

      // Second reprompt + listen, then loop back here.
      try {
        const stillThereUrl2 = await synthesizeTTS("Are you still there?", callSid);
        twiml.play(stillThereUrl2);
      } catch (err) {
        twiml.pause({ length: 0.2 });
      }

      twiml.gather({
        input: "speech",
        action: "/api/twilio/handle-speech",
        method: "POST",
        timeout: 10,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });

      twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");
      res.type("text/xml");
      return res.send(twiml.toString());
    }

    if (speechResult) {
      addTranscript(callSid, { speaker: "prospect", text: speechResult });
    }

    const normalizedSpeech = String(speechResult || "").toLowerCase();

    const isOptOut =
      /\b(do not call|don't call|stop calling|remove me|take me off|unsubscribe|opt out)\b/i.test(normalizedSpeech);
    const isNotInterested =
      /\b(not interested|no thanks|no thank you|not a fit|not for me|not now|no i'?m not|no, i'?m not|i'?m not interested)\b/i.test(normalizedSpeech);

    // Only hard-close for explicit opt-outs (do not call list requests)
    if (isOptOut) {
      const closingLine = "Understood — I'll take you off our list. Sorry for the interruption.";
      addTranscript(callSid, { speaker: "agent", text: closingLine });
      try {
        const audioUrl = await synthesizeTTS(closingLine, callSid);
        console.log(`[AI Reply] Playing: ${audioUrl}`);
        twiml.play(audioUrl);
      } catch {
        twiml.say({ voice: "Polly.Joanna" }, closingLine);
      }
      twiml.pause({ length: 0.5 });
      twiml.hangup();
      res.type("text/xml");
      return res.send(twiml.toString());
    }
    // NOTE: "not interested" is now handled by AI, which will offer State of AI report as fallback

    // If we just asked to VERIFY an email on file, handle the response deterministically.
    if (call.leadEmail) {
      const lastAgentLine = [...(call.transcript || [])]
        .reverse()
        .find((t) => t && t.speaker === "agent" && typeof t.text === "string");

      const lastAskedToVerifyEmail =
        lastAgentLine && /have your email as/i.test(lastAgentLine.text);

      if (lastAskedToVerifyEmail) {
        const normalized = String(speechResult || "").toLowerCase();
        const confirmed = /\b(yes|yep|yeah|correct|that's correct|right|sure|exactly)\b/i.test(normalized);
        const denied = /\b(no|nope|wrong|not correct|that's not)\b/i.test(normalized);

        // Very lightweight email extraction from speech-to-text
        const candidate = normalized
          .replace(/\s+at\s+/g, "@")
          .replace(/\s+dot\s+/g, ".")
          .replace(/\s+/g, "")
          .trim();
        const containsEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(candidate);

        if (confirmed) {
          const closingLine = "Perfect — I'll send over some times. Talk soon!";
          addTranscript(callSid, { speaker: "agent", text: closingLine });
          try {
            const audioUrl = await synthesizeTTS(closingLine, callSid);
            console.log(`[AI Reply] Playing: ${audioUrl}`);
            twiml.play(audioUrl);
          } catch {
            twiml.say({ voice: "Polly.Joanna" }, closingLine);
          }
          twiml.pause({ length: 1.5 });
          twiml.hangup();
          res.type("text/xml");
          return res.send(twiml.toString());
        }

        if (denied || containsEmail) {
          const newEmail = containsEmail ? candidate : null;
          if (newEmail) {
            updateCall(callSid, { leadEmail: newEmail });
          }
          const usedEmail = newEmail || call.leadEmail;
          const closingLine = `Got it — I'll use ${usedEmail}. I'll send over some times. Talk soon!`;
          addTranscript(callSid, { speaker: "agent", text: closingLine });
          try {
            const audioUrl = await synthesizeTTS(closingLine, callSid);
            console.log(`[AI Reply] Playing: ${audioUrl}`);
            twiml.play(audioUrl);
          } catch {
            twiml.say({ voice: "Polly.Joanna" }, closingLine);
          }
          twiml.pause({ length: 1.5 });
          twiml.hangup();
          res.type("text/xml");
          return res.send(twiml.toString());
        }

        // Unclear response — restate the email we have and ask again.
        const reprompt = `Sorry — just confirming, is it ${call.leadEmail}?`;
        addTranscript(callSid, { speaker: "agent", text: reprompt });
        try {
          const audioUrl = await synthesizeTTS(reprompt, callSid);
          console.log(`[AI Reply] Playing: ${audioUrl}`);
          twiml.play(audioUrl);
        } catch {
          twiml.say({ voice: "Polly.Joanna" }, reprompt);
        }
        twiml.pause({ length: 0.3 });
        twiml.gather({
          input: "speech",
          action: "/api/twilio/handle-speech",
          method: "POST",
          timeout: 10,
          speechTimeout: "auto",
          speechModel: "phone_call",
          enhanced: true,
          profanityFilter: false,
          language: "en-US"
        });
        twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");
        res.type("text/xml");
        return res.send(twiml.toString());
      }
    }

    // Deterministic email verification when we already have it on file:
    // If the prospect just agreed to a meeting/demo and we have leadEmail, immediately verify it.
    const meetingIntentPositive =
      /\b(let'?s|lets)\b.*\b(meet|book|schedule)\b/i.test(speechResult) ||
      /\b(book|schedule)\b.*\b(time|demo|meeting|call)\b/i.test(speechResult) ||
      /\b(send)\b.*\b(times|slots)\b/i.test(speechResult) ||
      /\b(next week|monday|tuesday|wednesday|thursday|friday)\b.*\b(meet|demo|call)\b/i.test(speechResult) ||
      /\b(demo|meeting|call)\b.*\b(next week|monday|tuesday|wednesday|thursday|friday)\b/i.test(speechResult);
    const meetingIntentNegative =
      /\b(not interested|no thanks|don't want|do not want|dont want|not a fit|stop calling)\b/i.test(normalizedSpeech) &&
      /\b(demo|meeting|call|schedule|book)\b/i.test(normalizedSpeech);

    if (call.leadEmail && meetingIntentPositive && !meetingIntentNegative && call.transcript.length >= 6) {
      const verifyEmailLine = `Perfect! I have your email as ${call.leadEmail}—is that still the best one to reach you?`;
      addTranscript(callSid, { speaker: "agent", text: verifyEmailLine });
      try {
        const audioUrl = await synthesizeTTS(verifyEmailLine, callSid);
        console.log(`[AI Reply] Playing: ${audioUrl}`);
        twiml.play(audioUrl);
      } catch (err) {
        twiml.pause({ length: 0.2 });
      }

      twiml.pause({ length: 0.3 });
      twiml.gather({
        input: "speech",
        action: "/api/twilio/handle-speech",
        method: "POST",
        timeout: 10,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });

      // If Twilio doesn't capture speech, keep looping without replaying the greeting.
      twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");

      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // Get AI reply with timeout protection (handled inside getAiSdrReply)
    const reply = await getAiSdrReply({
      script: call.script,
      transcript: call.transcript,
      latestUserText: speechResult,
      sttConfidence: Number(confidence || 0),
      userId: call.userId,
      leadEmail: call.leadEmail,
      leadRegion: call.leadRegion
    });

    addTranscript(callSid, { speaker: "agent", text: reply });

    // Play AI reply with TTS (ElevenLabs with Polly fallback)
    try {
      const audioUrl = await synthesizeTTS(reply, callSid);
      console.log(`[AI Reply] Playing: ${audioUrl}`);
      twiml.play(audioUrl);
    } catch (err) {
      console.error("[AI Reply] TTS failed, using Polly:", err.message);
      twiml.say({ voice: "Polly.Joanna" }, reply);
    }

    // Check if this is a closing statement (thanks, goodbye, talk soon, etc.)
    // Be careful not to match "chat" or "good time to chat"
    const isClosing = /\b(thanks for your time|talk to you soon|have a great day|have a good day|have a wonderful day|looking forward to our call|appreciate your interest|goodbye|bye now|take care|speak soon|catch you later)\b/i.test(reply);

    // Also check if conversation has gone on too long (10+ exchanges)
    const conversationLength = call.transcript.length;
    const shouldEnd = isClosing || conversationLength > 20;

    if (shouldEnd) {
      // End the call gracefully after closing statement
      console.log(`[Call End] Closing detected (isClosing: ${isClosing}, length: ${conversationLength}), ending call gracefully`);
      twiml.pause({ length: 2 });
      twiml.hangup();
    } else {
      // Continue conversation
      twiml.pause({ length: 0.3 });

      // Gather next response with Enhanced Speech Model
      twiml.gather({
        input: "speech",
        action: "/api/twilio/handle-speech",
        method: "POST",
        timeout: 10,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });

      // Loop to avoid TwiML ending the call on repeated silence
      twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");
    }

    res.type("text/xml");
    res.send(twiml.toString());
  } catch (err) {
    console.error("[Error] handle-speech failed:", err.message);
    console.error("[Error] Stack:", err.stack);

    // More graceful error message
    twiml.say("I apologize, I'm having a technical issue on my end. I'll follow up with you via email shortly. Thanks for your time!");
    twiml.pause({ length: 1 });
    twiml.hangup();

    res.type("text/xml");
    res.send(twiml.toString());
  }
});

// ---------- Twilio Status Callback ----------

app.post("/api/twilio/status", async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const callId = req.query.callId;
  const campaignId = req.query.campaignId;
  const call = getCall(callSid);

  if (!call) {
    return res.sendStatus(200);
  }

  updateCall(callSid, { status: callStatus });

  if (callStatus === "completed") {
    try {
      const summary = await summarizeCall({ transcript: call.transcript });
      updateCall(callSid, { summary });
    } catch (err) {
      console.error("Error summarizing call:", err);
    }
  }

  // Handle bulk campaign call completion
  if (campaignId && (callStatus === "completed" || callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer")) {
    try {
      await handleCallComplete(callId, campaignId, callStatus);
    } catch (err) {
      console.error("Error handling bulk call completion:", err);
    }
  }

  res.sendStatus(200);
});

// ---------- Frontend Integration Routes ----------

// Initiate call from frontend
app.post("/api/twilio/initiate-call", initiateCall);

// Get call status
app.get("/api/calls/:callId/status", (req, res) => {
  const call = getActiveCall(req.params.callId);
  if (!call) {
    return res.status(404).json({ error: 'Call not found' });
  }
  res.json({
    status: call.status || 'active',
    transcript: call.transcript,
    duration: call.duration,
  });
});

// ---------- Bulk Calling Routes ----------

// Start a bulk calling campaign
app.post("/api/bulk-calls/start", async (req, res) => {
  try {
    const { campaignId, userId } = req.body;
    if (!campaignId || !userId) {
      return res.status(400).json({ error: 'Missing campaignId or userId' });
    }
    const result = await startCampaign(campaignId, userId);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('[BulkCall] Start error:', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// Control a bulk calling campaign (pause/resume/cancel)
app.post("/api/bulk-calls/control", async (req, res) => {
  try {
    const { campaignId, action } = req.body;
    if (!campaignId || !action) {
      return res.status(400).json({ error: 'Missing campaignId or action' });
    }
    const result = await controlCampaign(campaignId, action);
    res.json(result);
  } catch (error) {
    console.error('[BulkCall] Control error:', error);
    res.status(500).json({ error: 'Failed to control campaign' });
  }
});

// ---------- Start server ----------

const server = app.listen(PORT, () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
});

// Attach WebSocket servers
attachMediaStreamServer(server);
attachRealtimeVoiceServer(server);
