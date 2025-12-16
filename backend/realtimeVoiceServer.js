// realtimeVoiceServer.js - OpenAI Realtime API Integration
import { WebSocketServer } from "ws";
import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { getActiveCall, updateCallTranscript } from "./routes/initiate-call.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17";

// Session management
const sessions = new Map();

/**
 * Build the system instructions for Alex (SDR persona)
 */
function buildRealtimeInstructions(call) {
  const leadName = call.leadName || "there";
  const script = call.script || "";
  
  return `You are Alex, a warm and professional Sales Development Representative from Atomicwork.

PERSONALITY:
- Warm, relaxed, confident (late 20s/30s human SDR)
- Use contractions, fillers ("honestly", "totally fair")
- Keep replies SHORT and punchy (<20 words per turn)
- Sound human, not robotic

PRODUCT (Atomicwork):
- AI-native ITSM & ESM platform
- Universal AI agent (Atom) works in Slack/Teams
- Agentic service management with CMDL (Context Management Data Lake)
- Target: IT leaders (CIO, Head of IT, etc.)

AGENTIC AI CAPABILITIES (Use these to convince and differentiate):
- **Autonomous Reasoning**: Unlike chatbots, agentic AI reasons through complex problems and takes action autonomously.
- **Self-Healing IT**: Detects, diagnoses, and fixes issues before users notice. Example: "VPN drops? Atom fixes it before you even call."
- **Cross-System Orchestration**: One request triggers actions across Okta, ServiceNow, Slack—no manual handoffs.
- **Natural Language Actions**: Users describe what they need in plain English. No forms, no portals.
- **Proactive Intelligence**: Predicts issues before they happen. Example: "Schedules laptop replacement before battery dies."
- **Context-Aware**: Checks permissions, user history, and org context before acting. Full audit trails.

PAIN POINT RESPONSES:
- If they mention MANUAL PROCESSES: "Agentic AI handles multi-step workflows autonomously—provision access across 5 systems with one Slack message."
- If they mention HIGH TICKET VOLUME: "Agentic models actually resolve, not just deflect. They reason, act, and close the loop."
- If they mention SLOW RESPONSE: "Agentic AI responds instantly and can fix issues proactively—before users notice."
- If they mention TOOL SPRAWL: "One conversation orchestrates across all systems—AD, Okta, ServiceNow, Slack."
- If they mention LOW ADOPTION: "Meets employees in Slack/Teams. No portals, just natural conversation."

AI EXPLORATION RESPONSES:
- If they mention "exploring AI" or "AI initiatives" generally: "That's great timing! We're hosting the Sydney AI Summit—it's bringing together IT leaders to discuss how they're moving from basic chatbots to agentic AI that actually takes action. Want me to share what we're covering?"
- If they ask about AI trends: "Honestly, the biggest shift we're seeing is from reactive AI to agentic systems. We're seeing this firsthand as we prepare for the Sydney AI Summit where 73% of attending IT leaders are planning agentic implementations."
- If they're early in AI journey: "Totally fair to be exploring. We're compiling insights from 50+ IT leaders for our Sydney AI Summit—it might save you some research time. Happy to walk you through what's working."

CONVERSATION FLOW:
1. Greeting & Rapport (brief, friendly)
2. Discovery (ask about current ITSM, pain points)
3. Consultative (educate on agentic AI capabilities based on their pain)
4. Pitch (position Atomicwork as the agentic solution)
5. Email Verification (verify email on file, don't ask for it)
6. Close (book demo/next steps)

EMAIL VERIFICATION:
- If we have their email: "Perfect! I have your email as [their email]—is that still the best one?"
- If they confirm: "Great, I'll send over some times. Talk soon!"
- If they give a different one: "Got it, I'll use that instead."
- NEVER ask "What's your email?" if we already have it.

RULES:
- NEVER admit to being AI
- NO technical jargon (tokens, JSON, etc.)
- Keep responses conversational and natural
- Listen actively, acknowledge objections
- When they share pain, RESPOND with relevant agentic capability
- If they say goodbye, end gracefully

LEAD INFO:
Name: ${leadName}
Email: ${call.leadEmail || 'not on file'}
Opening: ${script.substring(0, 200)}

CRITICAL: Follow the script above as your primary guide for responses. Do NOT generate generic questions about IT service management. Use the script content to drive your responses and conversation flow. Only deviate from the script when the conversation naturally goes off-script.`;
}
/**
 * Attach Realtime Voice WebSocket server
 */
export function attachRealtimeVoiceServer(httpServer) {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: "/twilio-realtime-voice" 
  });

  wss.on("connection", async (twilioWs, req) => {
    const connectionId = uuidv4();
    console.log('[Realtime] New Twilio connection: ' + connectionId);

    let streamSid = null;
    let callSid = null;
    let openaiWs = null;
    let sessionId = null;

    // Handle messages from Twilio
    twilioWs.on("message", async (msg) => {
      let data;
      try {
        data = JSON.parse(msg);
      } catch {
        return;
      }

      switch (data.event) {
        case "start": {
          streamSid = data.start.streamSid;
          callSid = data.start.callSid;
          console.log('[Realtime] Stream started: CallSid=' + callSid + ', StreamSid=' + streamSid);

          const call = getActiveCall(callSid);
          if (!call) {
            console.error('[Realtime] Call not found for CallSid: ' + callSid);
            console.log('[Realtime] Available call IDs:', Array.from(sessions.keys()));
            return;
          }
          
          console.log('[Realtime] Call metadata found:', { leadName: call.leadName, voicePersona: call.voicePersona });

          // Connect to OpenAI Realtime API
          try {
            openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
              headers: {
                "Authorization": "Bearer " + OPENAI_API_KEY,
                "OpenAI-Beta": "realtime=v1"
              }
            });

            openaiWs.on("open", () => {
              console.log('[Realtime] Connected to OpenAI for CallSid=' + callSid);
              
              // Configure session
              const sessionConfig = {
                type: "session.update",
                session: {
                  modalities: ["text", "audio"],
                  instructions: buildRealtimeInstructions(call),
                  voice: call.voicePersona === "male" ? "alloy" : "shimmer",
                  input_audio_format: "g711_ulaw",
                  output_audio_format: "g711_ulaw",
                  input_audio_transcription: {
                    model: "whisper-1"
                  },
                  turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500
                  },
                  temperature: 0.8,
                  max_response_output_tokens: 150
                }
              };

              openaiWs.send(JSON.stringify(sessionConfig));
              console.log('[Realtime] Session configured');
              
              // Send initial greeting prompt to start conversation
              setTimeout(() => {
                const greetingPrompt = {
                  type: "conversation.item.create",
                  item: {
                    type: "message",
                    role: "user",
                    content: [
                      {
                        type: "input_text",
                        text: "[Call connected. Start the conversation with your opening line.]"
                      }
                    ]
                  }
                };
                openaiWs.send(JSON.stringify(greetingPrompt));
                
                // Trigger response
                const responseRequest = {
                  type: "response.create"
                };
                openaiWs.send(JSON.stringify(responseRequest));
                console.log('[Realtime] Initial greeting triggered');
              }, 500);
            });

            // Handle OpenAI messages
            openaiWs.on("message", (message) => {
              try {
                const event = JSON.parse(message);
                handleOpenAIEvent(event, twilioWs, streamSid, callSid);
              } catch (err) {
                console.error('[Realtime] Error parsing OpenAI message:', err);
              }
            });

            openaiWs.on("error", (err) => {
              console.error('[Realtime] OpenAI WebSocket error:', err);
            });

            openaiWs.on("close", () => {
              console.log('[Realtime] OpenAI connection closed for CallSid=' + callSid);
            });

            // Store session
            sessions.set(streamSid, {
              twilioWs,
              openaiWs,
              callSid,
              streamSid
            });

          } catch (err) {
            console.error('[Realtime] Failed to connect to OpenAI:', err);
          }
          break;
        }

        case "media": {
          // Forward audio from Twilio to OpenAI
          if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
            const audioAppend = {
              type: "input_audio_buffer.append",
              audio: data.media.payload // base64 μ-law from Twilio
            };
            openaiWs.send(JSON.stringify(audioAppend));
          }
          break;
        }

        case "mark": {
          // Audio playback markers
          break;
        }

        case "stop": {
          console.log('[Realtime] Stream stopped for CallSid=' + callSid);
          if (openaiWs) {
            openaiWs.close();
          }
          sessions.delete(streamSid);
          break;
        }

        default:
          break;
      }
    });

    twilioWs.on("close", () => {
      console.log('[Realtime] Twilio connection closed: ' + connectionId);
      if (openaiWs) {
        openaiWs.close();
      }
      sessions.delete(streamSid);
    });

    twilioWs.on("error", (err) => {
      console.error('[Realtime] Twilio WebSocket error:', err);
      if (openaiWs) {
        openaiWs.close();
      }
      sessions.delete(streamSid);
    });
  });

  console.log("✅ Realtime Voice WebSocket server attached at /twilio-realtime-voice");
}

/**
 * Handle events from OpenAI Realtime API
 */
function handleOpenAIEvent(event, twilioWs, streamSid, callSid) {
  switch (event.type) {
    case "session.created":
      console.log('[Realtime] Session created: ' + event.session.id);
      break;

    case "session.updated":
      console.log('[Realtime] Session updated');
      break;

    case "input_audio_buffer.speech_started":
      console.log('[Realtime] User started speaking');
      // Could interrupt AI here if needed
      break;

    case "input_audio_buffer.speech_stopped":
      console.log('[Realtime] User stopped speaking');
      break;

    case "conversation.item.input_audio_transcription.completed":
      const userTranscript = event.transcript;
      console.log('[Realtime] User said: "' + userTranscript + '"');
      updateCallTranscript(callSid, { speaker: "prospect", text: userTranscript });
      break;

    case "response.audio.delta":
      // Stream audio from OpenAI to Twilio
      if (twilioWs.readyState === WebSocket.OPEN) {
        const audioMessage = {
          event: "media",
          streamSid: streamSid,
          media: {
            payload: event.delta // base64 μ-law audio
          }
        };
        twilioWs.send(JSON.stringify(audioMessage));
      }
      break;

    case "response.audio_transcript.delta":
      // Accumulate AI transcript
      break;

    case "response.audio_transcript.done":
      const aiTranscript = event.transcript;
      console.log('[Realtime] AI said: "' + aiTranscript + '"');
      updateCallTranscript(callSid, { speaker: "agent", text: aiTranscript });
      break;

    case "response.done":
      console.log('[Realtime] Response completed');
      break;

    case "error":
      console.error('[Realtime] OpenAI error:', event.error);
      break;

    default:
      // Ignore other events
      break;
  }
}

/**
 * Send mark to track audio playback completion
 */
function sendMark(twilioWs, streamSid, markName) {
  const markMessage = {
    event: "mark",
    streamSid: streamSid,
    mark: {
      name: markName
    }
  };
  twilioWs.send(JSON.stringify(markMessage));
}
