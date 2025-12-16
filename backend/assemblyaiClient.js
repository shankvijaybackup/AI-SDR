// assemblyaiClient.js
import { AssemblyAI, RealtimeTranscriber } from "assemblyai";

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

/**
 * Create an AssemblyAI real-time transcription connection
 */
export function createAssemblyAIConnection() {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error("ASSEMBLYAI_API_KEY is not set");
  }

  const client = new AssemblyAI({ apiKey: ASSEMBLYAI_API_KEY });

  const transcriber = client.realtime.transcriber({
    sampleRate: 8000,
    encoding: "pcm_mulaw"
  });

  return transcriber;
}

/**
 * Extract transcript from AssemblyAI result
 */
export function extractAssemblyTranscript(result) {
  try {
    const text = result.text || "";
    const confidence = result.confidence || 0;
    
    return {
      text: text.trim(),
      confidence: confidence,
      isFinal: result.message_type === "FinalTranscript"
    };
  } catch (err) {
    console.error("[AssemblyAI] Error extracting transcript:", err);
    return { text: "", confidence: 0, isFinal: false };
  }
}
