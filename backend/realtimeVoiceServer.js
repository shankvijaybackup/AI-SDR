// realtimeVoiceServer.js
// Realtime voice pipeline — OpenAI Realtime API removed
// New stack: Deepgram STT → Groq/Claude LLM → Deepgram TTS → Twilio
//
// Latency target: ~600-900ms total (vs ~200ms OpenAI Realtime)
// Tradeoff: ~400ms extra latency, zero OpenAI dependency

import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import { createDeepgramConnection, extractTranscript, MIN_CONFIDENCE_THRESHOLD } from "./deepgramClient.js";
import { synthesizeWithDeepgram } from "./deepgramTTSClient.js";
import { getAiSdrReply } from "./claudeClient.js";
import { getActiveCall } from "./routes/initiate-call.js";
import { addTranscript } from "./callState.js";

const sessions = new Map();
const SPEECH_PAUSE_MS = 700; // ms of silence before sending to LLM

// ─── Instructions builder (preserved from original) ───────────────────────────

function buildRealtimeInstructions(call) {
  const leadName = call.leadName || "there";
  const script = call.script || "";
  const leadContext = call.leadContext || {};
  const persona = leadContext.linkedinPersona || {};

  const discProfile = persona.discProfile || "Unknown";
  const communicationStyle = persona.communicationStyle || "Professional and respectful";
  const motivators = persona.motivators || [];
  const talkingPoints = leadContext.talkingPoints || [];

  let toneInstructions = "";
  if (discProfile === "D") {
    toneInstructions = `DISC D-type: Direct, results-focused. Get to the point fast. ROI language.`;
  } else if (discProfile === "I") {
    toneInstructions = `DISC I-type: Enthusiastic, social. Build rapport. Emotional, story-driven language.`;
  } else if (discProfile === "S") {
    toneInstructions = `DISC S-type: Steady, supportive. Patient and empathetic. Emphasise stability.`;
  } else if (discProfile === "C") {
    toneInstructions = `DISC C-type: Analytical. Precise and data-driven. Back claims with numbers.`;
  }

  return `You are Alex, an SDR at Atomicwork, on a live phone call with ${leadName}.

CRITICAL RULES:
- 1-2 SHORT sentences MAX (under 25 words per response)
- Sound natural and human — you're on a phone call
- NEVER admit to being AI
- No asterisks, no stage directions, no labels
${toneInstructions ? `\nPERSONALITY: ${toneInstructions}` : ""}

GOAL FOR THIS CALL:
Get ${leadName} to agree to either:
1. Watch a 2-minute demo video, OR
2. Schedule a 15-minute call

CALL FLOW:
1. Confirm you have the right person
2. Get permission ("Is this a good time for 30 seconds?")
3. Share one discovery question about their IT challenges
4. Present one key value proposition
5. Propose next step (video or call)

PRODUCT (use only if asked):
Atomicwork is an AI service desk that works inside Slack and Teams. Resolves 40% of IT tickets in under 10 seconds.
${talkingPoints.length ? `\nKEY POINTS:\n${talkingPoints.slice(0, 3).map(p => `- ${p}`).join("\n")}` : ""}
${script ? `\nSCRIPT (guide only):\n${script.substring(0, 800)}` : ""}

LEAD: ${leadName} at ${call.prospectCompany || call.leadCompany || "their company"}

Reply ONLY with what you'd say aloud. No quotes, no labels.`;
}

// ─── Session cleanup ──────────────────────────────────────────────────────────

function cleanupSession(streamSid) {
  const session = sessions.get(streamSid);
  if (!session) return;
  if (session.speechTimer) clearTimeout(session.speechTimer);
  if (session.deepgramConn) {
    try { session.deepgramConn.finish(); } catch (_) {}
  }
  sessions.delete(streamSid);
}

// ─── Send TTS audio back to Twilio ───────────────────────────────────────────

async function sendAudioToTwilio(twilioWs, streamSid, text, callSid) {
  if (!text) return;
  try {
    const audioBuffer = await synthesizeWithDeepgram(text);
    if (!audioBuffer || !twilioWs || twilioWs.readyState !== 1 /* OPEN */) return;

    // Deepgram TTS returns PCM — convert to μ-law for Twilio
    // deepgramTTSClient.js should return mulaw-encoded buffer; adjust if needed
    const base64Audio = audioBuffer.toString("base64");

    twilioWs.send(JSON.stringify({
      event: "media",
      streamSid,
      media: { payload: base64Audio },
    }));

    // Track agent speech in transcript
    await addTranscript(callSid, { speaker: "agent", text });
    console.log(`[Realtime] 🤖 Agent: "${text.substring(0, 60)}"`);
  } catch (err) {
    console.error("[Realtime] TTS/send error:", err.message);
  }
}

// ─── WebSocket server ─────────────────────────────────────────────────────────

export function attachRealtimeVoiceServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws-realtime-voice" });

  wss.on("error", (err) => console.error("[Realtime] WSS error:", err));

  wss.on("connection", (twilioWs) => {
    const connectionId = uuidv4();
    console.log(`[Realtime] New Twilio connection: ${connectionId}`);

    let streamSid = null;
    let callSid = null;
    let call = null;
    let currentTranscript = "";
    let deepgramConn = null;
    let speechTimer = null;
    let transcript = [];

    twilioWs.on("message", async (msg) => {
      let data;
      try { data = JSON.parse(msg); } catch { return; }

      switch (data.event) {
        case "start": {
          streamSid = data.start.streamSid;
          callSid = data.start.callSid;
          call = getActiveCall(callSid);

          if (!call) {
            console.error(`[Realtime] Call not found: ${callSid}`);
            return;
          }

          console.log(`[Realtime] Stream started: ${callSid} | Lead: ${call.leadName}`);

          // Open Deepgram STT connection
          try {
            deepgramConn = createDeepgramConnection();

            deepgramConn.on("Results", async (result) => {
              const transcriptResult = extractTranscript(result);
              if (!transcriptResult) return;

              const { text, isFinal, confidence } = transcriptResult;
              if (!text || confidence < MIN_CONFIDENCE_THRESHOLD) return;

              if (isFinal) {
                currentTranscript = text;
                console.log(`[Realtime] 🎤 Prospect: "${text}"`);
                await addTranscript(callSid, { speaker: "prospect", text });
                transcript.push({ speaker: "prospect", text });

                // Debounce — wait for pause in speech
                if (speechTimer) clearTimeout(speechTimer);
                speechTimer = setTimeout(async () => {
                  try {
                    const reply = await getAiSdrReply({
                      transcript,
                      latestUserText: currentTranscript,
                      callSid,
                      leadName: call.leadName,
                      voicePersona: call.voicePersona,
                      script: call.script,
                      leadContext: call.leadContext || {},
                    });

                    if (reply) {
                      transcript.push({ speaker: "agent", text: reply });
                      await sendAudioToTwilio(twilioWs, streamSid, reply, callSid);
                    }
                  } catch (err) {
                    console.error("[Realtime] LLM error:", err.message);
                  }
                  speechTimer = null;
                }, SPEECH_PAUSE_MS);
              }
            });

            deepgramConn.on("error", (err) => {
              console.error("[Realtime] Deepgram error:", err.message);
            });

            sessions.set(streamSid, { twilioWs, deepgramConn, callSid, speechTimer: null });

            // Initial greeting
            setTimeout(async () => {
              const greeting = await getAiSdrReply({
                transcript: [],
                latestUserText: "[Call just connected. Say your opening line.]",
                callSid,
                leadName: call.leadName,
                voicePersona: call.voicePersona,
                script: call.script,
                leadContext: call.leadContext || {},
              });
              if (greeting) {
                transcript.push({ speaker: "agent", text: greeting });
                await sendAudioToTwilio(twilioWs, streamSid, greeting, callSid);
              }
            }, 800);

          } catch (err) {
            console.error("[Realtime] Failed to connect Deepgram:", err.message);
          }
          break;
        }

        case "media": {
          // Forward μ-law audio from Twilio → Deepgram
          if (deepgramConn && data.media?.payload) {
            try {
              const audioBuffer = Buffer.from(data.media.payload, "base64");
              deepgramConn.send(audioBuffer);
            } catch (err) {
              console.warn("[Realtime] Audio forward error:", err.message);
            }
          }
          break;
        }

        case "stop": {
          console.log(`[Realtime] Stream stopped: ${callSid}`);
          cleanupSession(streamSid);
          break;
        }

        default:
          break;
      }
    });

    twilioWs.on("close", () => {
      console.log(`[Realtime] Twilio WS closed: ${connectionId}`);
      if (streamSid) cleanupSession(streamSid);
    });

    twilioWs.on("error", (err) => {
      console.error(`[Realtime] Twilio WS error:`, err.message);
      if (streamSid) cleanupSession(streamSid);
    });
  });

  console.log("✅ Realtime Voice server attached at /ws-realtime-voice (Deepgram STT + Groq/Claude + Deepgram TTS)");
}
