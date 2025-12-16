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
  const truncatedText = truncateForTTS(text, 180);
  
  const voiceId = getVoiceIdForCall(callSid);
  const voiceType = voiceId === ELEVEN_VOICE_ID_FEMALE ? "Female" : "Male";
  console.log(`[ElevenLabs] Synthesizing (${voiceType}) for ${callSid}:`, truncatedText.substring(0, 50) + '...');

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

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

  // Extract first line/sentence from script as opening greeting
  let openingScript = "Hi, this is Alex from Atomicwork. How are you doing today?";
  if (customScript) {
    // Extract first sentence or up to first newline
    const firstLine = customScript.split(/[\n.!?]/)[0].trim();
    if (firstLine && firstLine.length > 10) {
      openingScript = firstLine;
    }
  }

  initCall(callSid, {
    script: customScript || "Default sales script",
    leadName: req.query.leadName || "there",
    companyName: ""
  });
  updateCall(callSid, { status: "in-progress" });

  console.log(`[Script] Using opening: ${openingScript.substring(0, 80)}...`);

  // Play greeting with TTS (auto-switches between Chatterbox/ElevenLabs)
  try {
    const audioUrl = await synthesizeTTS(openingScript, callSid);
    console.log(`[Greeting] Playing: ${audioUrl}`);
    twiml.play(audioUrl);
  } catch (err) {
    console.error("[Greeting] TTS failed, using Polly:", err);
    twiml.say({ voice: "Polly.Joanna" }, openingScript);
  }

  twiml.pause({ length: 0.5 });

  // Gather with Enhanced Speech Model for better accuracy
  twiml.gather({
    input: "speech",
    action: "/api/twilio/handle-speech",
    method: "POST",
    timeout: 8,
    speechTimeout: "auto",
    speechModel: "phone_call",  // Enhanced model for phone calls
    enhanced: true,              // Enable enhanced speech recognition
    profanityFilter: false,
    language: "en-US"
  });

  // Fallback if no speech detected
  twiml.say({ voice: "Polly.Joanna" }, "Are you still there?");
  twiml.gather({
    input: "speech",
    action: "/api/twilio/handle-speech",
    method: "POST",
    timeout: 8,
    speechTimeout: "auto",
    speechModel: "phone_call",
    enhanced: true,
    profanityFilter: false,
    language: "en-US"
  });

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

    if (speechResult) {
      addTranscript(callSid, { speaker: "prospect", text: speechResult });
    }

    // Get AI reply with timeout protection (handled inside getAiSdrReply)
    const reply = await getAiSdrReply({
      script: call.script,
      transcript: call.transcript,
      latestUserText: speechResult,
      sttConfidence: Number(confidence || 0),
      userId: call.userId,
      leadEmail: call.leadEmail
    });

    addTranscript(callSid, { speaker: "agent", text: reply });

    // Play AI reply with TTS - use Polly as fast fallback
    let audioPlayed = false;
    try {
      const audioUrl = await synthesizeTTS(reply, callSid);
      console.log(`[AI Reply] Playing: ${audioUrl}`);
      twiml.play(audioUrl);
      audioPlayed = true;
    } catch (err) {
      console.error("[TTS] Failed, using Polly:", err.message);
    }
    
    if (!audioPlayed) {
      // Fallback to Polly (faster, more reliable)
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
        timeout: 8,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });

      // Fallback if no speech detected
      twiml.say({ voice: "Polly.Joanna" }, "Are you still there?");
      twiml.gather({
        input: "speech",
        action: "/api/twilio/handle-speech",
        method: "POST",
        timeout: 8,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });
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

// ---------- Start server ----------

const server = app.listen(PORT, () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
});

// Attach WebSocket servers
attachMediaStreamServer(server);
attachRealtimeVoiceServer(server);
