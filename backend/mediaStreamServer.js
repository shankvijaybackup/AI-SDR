// mediaStreamServer.js
import { WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { createRealtimeSession, sendAudioFromTwilioPayload } from "./realtimeClient.js";
import { createDeepgramConnection, extractTranscript, MIN_CONFIDENCE_THRESHOLD } from "./deepgramClient.js";
import { getAiSdrReply } from "./openaiClient.js";
import { synthesizeTTS } from "./server.js";
import { getActiveCall, updateCallTranscript } from "./routes/initiate-call.js";
import { convertMp3ToMulaw, sendAudioToTwilio } from "./audioConverter.js";

// Load Fast Hello audio (base64)
const FAST_HELLO_PATH = path.join(process.cwd(), "fast_hello.txt");
let FAST_HELLO_PAYLOAD = null;

try {
  if (fs.existsSync(FAST_HELLO_PATH)) {
    FAST_HELLO_PAYLOAD = fs.readFileSync(FAST_HELLO_PATH, "utf-8").trim();
    console.log("[MediaStream] Fast Hello payload loaded.");
  } else {
    console.warn("[MediaStream] fast_hello.txt not found. Skipping fast hello.");
  }
} catch (err) {
  console.error("[MediaStream] Error loading fast_hello.txt:", err);
}

// Map callSid -> connection/session
const sessions = new Map();
const SPEECH_PAUSE_MS = 800; // Reduced from 1200ms for faster response

function scheduleOpenAiResponse(streamSid) {
  const sessionInfo = sessions.get(streamSid);
  if (!sessionInfo || !sessionInfo.openaiSession) {
    return;
  }
  if (sessionInfo.commitTimer) {
    clearTimeout(sessionInfo.commitTimer);
  }
  sessionInfo.commitTimer = setTimeout(() => {
    try {
      sessionInfo.openaiSession.commitAndRequestResponse();
    } catch (err) {
      console.error("[MediaStream] Failed to commit audio buffer:", err);
    }
    sessionInfo.commitTimer = null;
  }, SPEECH_PAUSE_MS);
}

function cleanupSession(streamSid) {
  const sessionInfo = sessions.get(streamSid);
  if (!sessionInfo) return;
  if (sessionInfo.commitTimer) {
    clearTimeout(sessionInfo.commitTimer);
  }
  sessions.delete(streamSid);
}

/**
 * Attach a WebSocket server to the existing HTTP server.
 */
export function attachMediaStreamServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/twilio-media-stream" });

  wss.on("connection", async (ws, req) => {
    const connectionId = uuidv4();
    console.log(`[MediaStream] New connection: ${connectionId}`);

    let twilioStreamSid = null;
    let callSid = null;
    let openaiSession = null;
    let deepgramConnection = null;
    let deepgramReady = false;
    let currentTranscript = "";
    let lastSpeechTime = null;
    let speechTimer = null;

    ws.on("message", async (msg) => {
      let data;
      try {
        data = JSON.parse(msg);
      } catch {
        return;
      }

      switch (data.event) {
        case "start": {
          twilioStreamSid = data.start.streamSid;
          callSid = data.start.callSid;
          console.log(`[MediaStream] Stream started for CallSid=${callSid}, StreamSid=${twilioStreamSid}`);

          // Verify call exists
          const call = getActiveCall(callSid);
          if (!call) {
            console.error(`[MediaStream] CRITICAL: Call not found for CallSid=${callSid}`);
            console.error(`[MediaStream] Available calls:`, Array.from(require('./routes/initiate-call.js').activeCalls.keys()));
            ws.close();
            return;
          }

          console.log(`[MediaStream] Call found: ${call.leadName}, Script: ${call.script?.substring(0, 50)}...`);

          // Play greeting first
          try {
            const openingScript = call.script || "Hi, this is Alex from Atomicwork. How are you doing today?";
            const audioUrl = await synthesizeTTS(
              openingScript,
              callSid,
              call.voicePersona,
              call.region,
              call.voiceId
            );
            console.log(`[Greeting] Synthesized: ${audioUrl}`);

            const mulawAudio = await convertMp3ToMulaw(audioUrl);
            console.log(`[Greeting] Sending audio to Twilio...`);
            sendAudioToTwilio(ws, twilioStreamSid, mulawAudio);
            console.log(`[Greeting] Audio sent`);
          } catch (err) {
            console.error("[Greeting] Error:", err);
          }

          // Initialize Deepgram for better ASR
          try {
            deepgramConnection = createDeepgramConnection();
            deepgramReady = true;
            console.log(`[Deepgram] Connected for CallSid=${callSid}`);

            deepgramConnection.on("Results", async (data) => {
              const result = extractTranscript(data);

              // Handle interim results for context but don't process yet
              if (!result.isFinal && result.text) {
                // Log interim for debugging
                console.log(`[Deepgram] Interim: "${result.text.substring(0, 50)}..."`);
                return;
              }

              // Only process final results with sufficient confidence
              if (result.isFinal && result.text) {
                // Reject low-confidence transcripts
                if (result.confidence < MIN_CONFIDENCE_THRESHOLD) {
                  console.log(`[Deepgram] Rejected low confidence (${result.confidence.toFixed(2)}): "${result.text}"`);
                  return;
                }

                // Reject very short or garbage transcripts
                const cleanText = result.text.trim();
                if (cleanText.length < 2 || /^[^\w]+$/.test(cleanText)) {
                  console.log(`[Deepgram] Rejected invalid transcript: "${cleanText}"`);
                  return;
                }

                console.log(`[Deepgram] ✓ Final: "${cleanText}" (confidence: ${result.confidence.toFixed(2)})`);
                currentTranscript = cleanText;
                lastSpeechTime = Date.now();

                // Clear existing timer
                if (speechTimer) clearTimeout(speechTimer);

                // Wait for speech to finish (800ms of silence for faster response)
                speechTimer = setTimeout(async () => {
                  if (!currentTranscript) return;

                  const call = getActiveCall(callSid);
                  if (!call) {
                    console.error(`[MediaStream] Call not found for CallSid: ${callSid}`);
                    return;
                  }

                  // Add to transcript with timestamp and speaker info
                  const timestamp = new Date().toISOString();
                  // Use diarization speaker if available, otherwise default to "prospect"
                  const speaker = result.speaker !== null ? `speaker_${result.speaker}` : "prospect";
                  updateCallTranscript(callSid, {
                    speaker: speaker,
                    text: currentTranscript,
                    timestamp,
                    confidence: result.confidence,
                    startTime: result.startTime,
                    endTime: result.endTime
                  });

                  // Get AI reply
                  console.log(`[AI] Processing: "${currentTranscript}"`);
                  const reply = await getAiSdrReply({
                    script: call.script,
                    transcript: call.transcript,
                    latestUserText: currentTranscript,
                    sttConfidence: result.confidence,
                    userId: call.userId,
                    leadEmail: call.leadEmail
                  });

                  // Add agent reply to transcript with timestamp
                  updateCallTranscript(callSid, {
                    speaker: "agent",
                    text: reply,
                    timestamp: new Date().toISOString()
                  });

                  // Play AI reply
                  try {
                    // Pass explicit voice params to ensure consistency/region-mapping
                    const audioUrl = await synthesizeTTS(
                      reply,
                      callSid,
                      call.voicePersona,
                      call.region,
                      call.voiceId
                    );

                    console.log(`[AI Reply] Synthesized: ${audioUrl}`);

                    const mulawAudio = await convertMp3ToMulaw(audioUrl);
                    console.log(`[AI Reply] Sending audio to Twilio...`);
                    sendAudioToTwilio(ws, twilioStreamSid, mulawAudio);
                    console.log(`[AI Reply] Audio sent`);
                  } catch (err) {
                    console.error("[AI Reply] Error:", err);
                  }

                  currentTranscript = "";
                }, 800); // Reduced to 800ms for faster response
              }
            });

            deepgramConnection.on("error", (err) => {
              console.error(`[Deepgram] Error:`, err);
            });

            deepgramConnection.on("close", () => {
              console.log(`[Deepgram] Connection closed for CallSid=${callSid}`);
            });
          } catch (err) {
            console.error(`[Deepgram] Failed to initialize:`, err);
          }
          break;
        }

        case "media": {
          const { payload } = data.media; // base64 μ-law audio from Twilio

          // Send audio to Deepgram for transcription
          if (deepgramConnection && deepgramReady) {
            const audioBuffer = Buffer.from(payload, "base64");
            deepgramConnection.send(audioBuffer);
          }
          break;
        }

        case "mark": {
          // markers, ignore for now
          break;
        }

        case "stop": {
          console.log(`[MediaStream] Stream stopped for CallSid=${callSid}`);
          if (deepgramConnection) {
            deepgramConnection.finish();
          }
          if (speechTimer) {
            clearTimeout(speechTimer);
          }
          cleanupSession(twilioStreamSid);
          break;
        }

        default:
          break;
      }
    });

    ws.on("close", async () => {
      console.log(`[MediaStream] Connection closed: ${connectionId}`);
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
      if (speechTimer) {
        clearTimeout(speechTimer);
      }
      cleanupSession(twilioStreamSid);
    });

    ws.on("error", async (err) => {
      console.error("[MediaStream] WebSocket error", err);
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
      if (speechTimer) {
        clearTimeout(speechTimer);
      }
      cleanupSession(twilioStreamSid);
    });
  });

  console.log("✅ MediaStream WebSocket server attached at /twilio-media-stream");
}
