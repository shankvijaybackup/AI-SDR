// Test Deepgram live transcription
import { createClient } from "@deepgram/sdk";
import "dotenv/config";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

async function testDeepgram() {
  console.log("[Test] Testing Deepgram connection...");
  
  try {
    const deepgram = createClient(DEEPGRAM_API_KEY);
    
    const connection = deepgram.listen.live({
      model: "nova-2",
      language: "en-US",
      smart_format: true,
      punctuate: true,
      interim_results: false,
      utterance_end_ms: 1200,
      vad_events: true,
      encoding: "mulaw",
      sample_rate: 8000,
      channels: 1
    });

    connection.on("open", () => {
      console.log("✅ Deepgram connection opened successfully");
      
      // Send a test audio buffer (silence)
      const testBuffer = Buffer.alloc(160, 0xFF); // µ-law silence
      connection.send(testBuffer);
      console.log("✅ Sent test audio buffer");
      
      setTimeout(() => {
        connection.finish();
        console.log("✅ Connection closed gracefully");
        process.exit(0);
      }, 2000);
    });

    connection.on("Results", (data) => {
      console.log("✅ Received Results event:", JSON.stringify(data, null, 2));
    });

    connection.on("error", (err) => {
      console.error("❌ Deepgram error:", err);
      process.exit(1);
    });

    connection.on("close", () => {
      console.log("✅ Deepgram connection closed");
    });

  } catch (err) {
    console.error("❌ Failed to initialize Deepgram:", err);
    process.exit(1);
  }
}

testDeepgram();
