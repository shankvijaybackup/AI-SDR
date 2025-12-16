// xttsClient.js
import { Buffer } from "buffer";
import g711 from "g711";

const { ulawFromPCM } = g711;

const XTTS_URL = process.env.XTTS_URL || "http://localhost:8000/tts";
const TWILIO_SAMPLE_RATE = 8000;
const XTTS_SAMPLE_RATE = 24000;

/**
 * Call the XTTS microservice and stream back audio chunks for Twilio.
 * 
 * @param {string} text - The text to speak
 * @param {string} speaker - The speaker ID (e.g. "alex")
 * @param {string} language - Language code (e.g. "en")
 * @returns {AsyncGenerator<string, void, unknown>} - Yields base64 encoded µ-law chunks
 */
export async function* synthesizeWithXTTS(text, speaker = "alex", language = "en") {
  try {
    const res = await fetch(XTTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, speaker, language })
    });

    if (!res.ok) {
      console.error(`XTTS failed: ${res.status} ${res.statusText}`);
      return;
    }

    if (!res.body) return;

    // Read the stream
    const reader = res.body.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // value is a Uint8Array of PCM 16-bit @ 24kHz
      if (value && value.length > 0) {
        // Convert chunk to Twilio format
        const twilioBase64 = pcm24kChunkToTwilioMulawBase64(value);
        yield twilioBase64;
      }
    }
  } catch (err) {
    console.error("Error calling XTTS service:", err);
  }
}

/**
 * Convert 24kHz PCM chunk to Twilio 8kHz µ-law base64
 */
function pcm24kChunkToTwilioMulawBase64(chunk) {
  // 1. Buffer -> Int16Array (24kHz)
  // Ensure we handle byte offset correctly if chunk is a Uint8Array
  const pcm24k = new Int16Array(
    chunk.buffer,
    chunk.byteOffset,
    chunk.byteLength / 2
  );

  // 2. Downsample 24k -> 8k (take every 3rd sample)
  const downFactor = XTTS_SAMPLE_RATE / TWILIO_SAMPLE_RATE; // 3
  const len8k = Math.floor(pcm24k.length / downFactor);
  const pcm8k = new Int16Array(len8k);

  for (let i = 0; i < len8k; i++) {
    pcm8k[i] = pcm24k[i * downFactor];
  }

  // 3. PCM16 -> µ-law bytes
  const mulawBytes = ulawFromPCM(pcm8k);
  
  // 4. Base64 encode
  return Buffer.from(mulawBytes).toString("base64");
}
