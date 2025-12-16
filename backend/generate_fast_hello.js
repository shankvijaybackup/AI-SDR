import fs from "fs";
import { Buffer } from "buffer";
import g711 from "g711";

const { ulawFromPCM } = g711;

/**
 * Pre-generate a static 'Hello' message in Twilio µ-law base64 format.
 * This allows us to play audio immediately upon connection, masking the XTTS cold-start latency.
 */
function generateFastHello() {
  const wavPath = "greeting.wav";
  
  if (!fs.existsSync(wavPath)) {
    console.error("greeting.wav not found. Run: say 'Hello...' -o greeting.wav --data-format=LEF32@24000");
    return;
  }

  // 1. Read the 24kHz float32 or int16 WAV (ignoring header for simplicity if we know format)
  // For 'say --data-format=LEF32@24000', we get raw float32 LE samples + header.
  // We'll just read the whole file and skip the 44-byte WAV header roughly.
  const fileBuf = fs.readFileSync(wavPath);
  
  // Skip 44 byte header (canonical WAV)
  const audioData = fileBuf.subarray(44);
  
  // Float32 -> Int16
  const float32 = new Float32Array(audioData.buffer, audioData.byteOffset, audioData.byteLength / 4);
  const pcm24k = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    pcm24k[i] = Math.max(-32768, Math.min(32767, float32[i] * 32767));
  }

  // Downsample 24k -> 8k
  const downFactor = 3;
  const len8k = Math.floor(pcm24k.length / downFactor);
  const pcm8k = new Int16Array(len8k);
  for (let i = 0; i < len8k; i++) {
    pcm8k[i] = pcm24k[i * downFactor];
  }

  // µ-law encode
  const mulaw = ulawFromPCM(pcm8k);
  
  // Base64
  const b64 = Buffer.from(mulaw).toString("base64");
  
  fs.writeFileSync("fast_hello.txt", b64);
  console.log("Generated fast_hello.txt with base64 audio payload.");
}

generateFastHello();
