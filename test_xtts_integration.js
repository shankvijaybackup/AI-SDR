import { synthesizeWithXTTS } from "./backend/xttsClient.js";

async function run() {
  console.log("Testing XTTS Integration...");
  const text = "Hello from the integration test.";
  let chunkCount = 0;
  let totalBytes = 0;

  try {
    for await (const chunkBase64 of synthesizeWithXTTS(text)) {
      chunkCount++;
      totalBytes += chunkBase64.length;
      process.stdout.write(".");
    }
    console.log("\nDone!");
    console.log(`Received ${chunkCount} chunks.`);
    console.log(`Total base64 bytes: ${totalBytes}`);
  } catch (err) {
    console.error("\nTest failed:", err);
  }
}

run();
