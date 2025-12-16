// audioConverter.js
import fetch from "node-fetch";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Convert MP3 audio from URL to base64 µ-law format for Twilio Media Streams
 * @param {string} mp3Url - URL to MP3 file
 * @returns {Promise<string>} Base64 encoded µ-law audio
 */
export async function convertMp3ToMulaw(mp3Url) {
  const tempDir = path.join(__dirname, "temp");
  await fs.mkdir(tempDir, { recursive: true });
  
  const mp3Path = path.join(tempDir, `${Date.now()}.mp3`);
  const mulawPath = path.join(tempDir, `${Date.now()}.ulaw`);
  
  try {
    // Download MP3
    const response = await fetch(mp3Url);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(mp3Path, Buffer.from(buffer));
    
    // Convert to µ-law using ffmpeg
    // Twilio expects: 8kHz, mono, µ-law
    await execAsync(
      `ffmpeg -i "${mp3Path}" -ar 8000 -ac 1 -f mulaw "${mulawPath}" -y`
    );
    
    // Read converted file
    const mulawBuffer = await fs.readFile(mulawPath);
    const base64 = mulawBuffer.toString("base64");
    
    // Cleanup
    await fs.unlink(mp3Path).catch(() => {});
    await fs.unlink(mulawPath).catch(() => {});
    
    return base64;
  } catch (err) {
    console.error("[AudioConverter] Error:", err);
    // Cleanup on error
    await fs.unlink(mp3Path).catch(() => {});
    await fs.unlink(mulawPath).catch(() => {});
    throw err;
  }
}

/**
 * Send audio to Twilio Media Stream in chunks
 * @param {WebSocket} ws - Twilio WebSocket connection
 * @param {string} streamSid - Twilio Stream SID
 * @param {string} base64Audio - Base64 encoded µ-law audio
 */
export function sendAudioToTwilio(ws, streamSid, base64Audio) {
  // Twilio expects audio in ~20ms chunks (160 bytes for 8kHz µ-law)
  const chunkSize = 160;
  const buffer = Buffer.from(base64Audio, "base64");
  
  let offset = 0;
  const interval = setInterval(() => {
    if (offset >= buffer.length) {
      clearInterval(interval);
      // Send mark to indicate audio finished
      ws.send(JSON.stringify({
        event: "mark",
        streamSid,
        mark: { name: "audio_complete" }
      }));
      return;
    }
    
    const chunk = buffer.slice(offset, offset + chunkSize);
    const payload = chunk.toString("base64");
    
    ws.send(JSON.stringify({
      event: "media",
      streamSid,
      media: { payload }
    }));
    
    offset += chunkSize;
  }, 20); // Send every 20ms
}
