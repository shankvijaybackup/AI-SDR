// Test AssemblyAI live transcription
import { AssemblyAI } from "assemblyai";
import "dotenv/config";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

async function testAssemblyAI() {
  console.log("[Test] Testing AssemblyAI connection...");
  
  try {
    const client = new AssemblyAI({
      apiKey: ASSEMBLYAI_API_KEY
    });

    const transcriber = client.realtime.transcriber({
      sampleRate: 8000,
      encoding: "pcm_mulaw"
    });

    transcriber.on("open", ({ sessionId }) => {
      console.log("✅ AssemblyAI connection opened successfully");
      console.log("✅ Session ID:", sessionId);
      
      // Send a test audio buffer (silence)
      const testBuffer = Buffer.alloc(160, 0xFF); // µ-law silence
      transcriber.sendAudio(testBuffer);
      console.log("✅ Sent test audio buffer");
      
      setTimeout(async () => {
        await transcriber.close();
        console.log("✅ Connection closed gracefully");
        process.exit(0);
      }, 2000);
    });

    transcriber.on("transcript", (transcript) => {
      console.log("✅ Received transcript:", JSON.stringify(transcript, null, 2));
    });

    transcriber.on("error", (err) => {
      console.error("❌ AssemblyAI error:", err);
      process.exit(1);
    });

    transcriber.on("close", () => {
      console.log("✅ AssemblyAI connection closed");
    });

    await transcriber.connect();
    console.log("✅ Connection initiated");

  } catch (err) {
    console.error("❌ Failed to initialize AssemblyAI:", err);
    process.exit(1);
  }
}

testAssemblyAI();
