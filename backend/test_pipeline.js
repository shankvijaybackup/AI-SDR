import g711 from "g711";
import { Buffer } from "buffer";

const { ulawFromPCM, ulawToPCM } = g711;

console.log("Testing g711 pipeline...");

// 1. Create fake PCM16 data (24kHz)
const pcm24k = new Int16Array(24000); // 1 second of silence/data
for(let i=0; i<pcm24k.length; i++) {
    pcm24k[i] = Math.sin(i * 0.1) * 10000; // Sine wave
}
console.log(`PCM24k size: ${pcm24k.length} samples`);

// 2. Downsample to 8kHz
const downFactor = 3;
const len8k = Math.floor(pcm24k.length / downFactor);
const pcm8k = new Int16Array(len8k);
for(let i=0; i<len8k; i++) {
    pcm8k[i] = pcm24k[i*downFactor];
}
console.log(`PCM8k size: ${pcm8k.length} samples`);

// 3. Convert to u-law
try {
    const mulawBytes = ulawFromPCM(pcm8k);
    console.log(`Mulaw bytes type: ${mulawBytes.constructor.name}`);
    console.log(`Mulaw bytes length: ${mulawBytes.length}`);
    
    // 4. Base64
    const b64 = Buffer.from(mulawBytes).toString("base64");
    console.log(`Base64 length: ${b64.length}`);
    console.log("Pipeline OK ✅");
} catch (err) {
    console.error("Pipeline FAILED ❌", err);
}
