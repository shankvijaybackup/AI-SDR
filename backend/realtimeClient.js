// realtimeClient.js
import WebSocket from "ws";
import { Buffer } from "buffer";
import g711 from "g711";
import { synthesizeWithXTTS } from "./xttsClient.js";

const { ulawToPCM, ulawFromPCM } = g711;

const OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const USE_XTTS = process.env.USE_XTTS === "true";

const TWILIO_SAMPLE_RATE = 8000;
const OPENAI_SAMPLE_RATE = 24000;

function decodeTwilioMediaToPcm24k(base64Payload) {
  // 1) base64 → Buffer of µ-law bytes
  const mulawBuf = Buffer.from(base64Payload, "base64");

  // 2) µ-law (8-bit) → PCM16 at 8 kHz
  // g711 library expects Uint8Array for ulawToPCM, returns Int16Array
  const pcm8k = ulawToPCM(new Uint8Array(mulawBuf)); 

  // 3) simple upsample 8k → 24k by duplicating samples 3×
  const upFactor = OPENAI_SAMPLE_RATE / TWILIO_SAMPLE_RATE; // 3
  const pcm24k = new Int16Array(pcm8k.length * upFactor);

  for (let i = 0; i < pcm8k.length; i++) {
    const s = pcm8k[i];
    const baseIndex = i * upFactor;
    for (let k = 0; k < upFactor; k++) {
      pcm24k[baseIndex + k] = s;
    }
  }

  return Buffer.from(pcm24k.buffer);
}

function encodePcm24kToTwilioBase64(pcm24kBuf) {
  // 1) Buffer → Int16Array for 24 kHz PCM
  const pcm24k = new Int16Array(
    pcm24kBuf.buffer,
    pcm24kBuf.byteOffset,
    pcm24kBuf.byteLength / Int16Array.BYTES_PER_ELEMENT
  );

  // 2) downsample 24k → 8k by taking every 3rd sample
  const downFactor = OPENAI_SAMPLE_RATE / TWILIO_SAMPLE_RATE; // 3
  const len8k = Math.floor(pcm24k.length / downFactor);
  const pcm8k = new Int16Array(len8k);

  for (let i = 0; i < len8k; i++) {
    pcm8k[i] = pcm24k[i * downFactor];
  }

  // 3) PCM16 → µ-law bytes
  const mulawBytes = ulawFromPCM(pcm8k);
  const mulawBuf = Buffer.from(mulawBytes);

  // 4) µ-law bytes → base64 for Twilio media.payload
  return mulawBuf.toString("base64");
}

export async function createRealtimeSession({ streamSid, twilioWs }) {
  const ws = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1"
    }
  });

  const messageQueue = [];

  ws.on("open", () => {
    console.log(`[Realtime] Connected to OpenAI Realtime (XTTS=${USE_XTTS})`);
    
    // Flush queue
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      console.log("[Realtime] Flushing queued message");
      ws.send(msg);
    }

    // Configure session for 24k PCM audio
    const sessionUpdate = {
      type: "session.update",
      session: {
        instructions: `
You are Alex, a friendly and sharp SDR at Atomicwork.

Target ICP:
Heads of IT, Directors of IT Operations, ITSM Managers and Digital Workplace leaders
in 500–5000 employee SaaS companies who currently run ServiceNow for ITSM.

Atomicwork value for this ICP:
- AI-native ITSM and employee support platform.
- AI agent in Slack/Teams to deflect a large share of common IT requests.
- CMDL (Context Management Data Lake) that unifies real-time data from HR, MDM, CMDB, security and SaaS systems.
- Modern automation for onboarding/offboarding, approvals and access.
- Lightweight alternative to ServiceNow for employee experience and internal workflows.

Core pains to listen for:
- ServiceNow is too heavy/complex; small changes require too much admin.
- Portal adoption is low; employees prefer Slack/Teams/email.
- CMDB is stale or incomplete.
- Too many tools across IT/HR/Finance.
- Low automation; many workflows are still manual.
- High volume of repetitive tickets.

Speaking style:
- Sound like a real human SDR, relaxed, confident and conversational.
- Use contractions: I'm, you're, it's, we’ve, don’t.
- Short replies: 1–2 sentences, under ~20 words.
- Light fillers: "yeah makes sense", "honestly", "totally get that".
- Never sound like you're reading.

Conversation strategy:
1. Open with a short intro about Atomicwork.
2. Ask 1–2 discovery questions about their ServiceNow experience.
3. Surface pains like portal adoption, automation gaps, CMDB issues.
4. Position Atomicwork as a lightweight, AI-native complement or alternative.
5. If there is fit, propose a short follow-up call or permission to send an email.
6. If not a fit, politely close.

Objection handling:
- "We already use ServiceNow."
  -> "Makes sense — most teams we speak with do too. They use Atomicwork to modernize Slack/Teams experience and automate repetitive work."

- "We don’t have time."
  -> "Totally fair. If I send a quick summary and a couple of examples, would that be okay?"

Strict rules:
- You are speaking on a live phone call.
- Never say you are an AI or bot.
- Never mention prompts, models, JSON or internal details.
- Keep everything natural, spoken, and concise.
        `,
        voice: "alloy",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad" },
        modalities: USE_XTTS ? ["text"] : ["audio", "text"]
      }
    };

    ws.send(JSON.stringify(sessionUpdate));
  });

  ws.on("message", async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    // 1. Handle Audio from OpenAI (if XTTS is disabled)
    if (!USE_XTTS && msg.type === "response.audio.delta" && msg.delta) {
      const pcm24kBuf = Buffer.from(msg.delta, "base64");
      const twilioBase64 = encodePcm24kToTwilioBase64(pcm24kBuf);

      if (twilioWs && twilioWs.readyState === WebSocket.OPEN) {
        const twilioMediaMsg = {
          event: "media",
          streamSid,
          media: { payload: twilioBase64 }
        };
        twilioWs.send(JSON.stringify(twilioMediaMsg));
      }
    }

    // 2. Handle Text from OpenAI (if XTTS is enabled)
    if (USE_XTTS && msg.type === "response.text.done" && msg.text) {
      console.log("[XTTS] Synthesizing:", msg.text);
      // Call XTTS and stream back to Twilio
      // Note: This does not block the WebSocket loop, but we await it to ensure order if possible
      // In a real app, you might want a queue to prevent overlapping speech
      try {
        for await (const chunkBase64 of synthesizeWithXTTS(msg.text)) {
           if (twilioWs && twilioWs.readyState === WebSocket.OPEN) {
            const twilioMediaMsg = {
              event: "media",
              streamSid,
              media: { payload: chunkBase64 }
            };
            twilioWs.send(JSON.stringify(twilioMediaMsg));
          }
        }
      } catch (err) {
        console.error("[XTTS] Error streaming audio:", err);
      }
    }

    if (msg.type === "response.audio_transcript.done") {
        console.log("AI Transcript:", msg.transcript);
    }
    
    // Log errors from OpenAI
    if (msg.type === "error") {
        console.error("OpenAI Error:", msg.error);
    }
  });

  ws.on("close", () => {
    console.log("[Realtime] OpenAI session closed");
  });

  ws.on("error", (err) => {
    console.error("[Realtime] Error:", err);
  });

  return {
    ws,
    sendText(text) {
      if (ws.readyState === WebSocket.OPEN) {
        const event = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text }]
          }
        };
        ws.send(JSON.stringify(event));
        ws.send(JSON.stringify({ type: "response.create" }));
      } else {
        console.log("[Realtime] WS not open, queuing message:", text);
        messageQueue.push(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text }]
          }
        }));
        messageQueue.push(JSON.stringify({ type: "response.create" }));
      }
    },
    commitAndRequestResponse() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      ws.send(
        JSON.stringify({
          type: "input_audio_buffer.commit"
        })
      );
      ws.send(JSON.stringify({ type: "response.create" }));
    },
    close() {
      try {
        ws.close();
      } catch (e) {
        // ignore
      }
    }
  };
}

export function sendAudioFromTwilioPayload(session, base64Payload) {
  const ws = session.ws;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const pcm24k = decodeTwilioMediaToPcm24k(base64Payload);

  const event = {
    type: "input_audio_buffer.append",
    audio: pcm24k.toString("base64")
  };

  ws.send(JSON.stringify(event));
}
