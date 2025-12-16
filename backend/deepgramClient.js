// deepgramClient.js
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

/**
 * Create a Deepgram live transcription connection for real-time ASR
 */
export function createDeepgramConnection() {
  if (!DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not set");
  }

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

  return connection;
}

/**
 * Process Deepgram transcription and extract final transcript with confidence
 */
export function extractTranscript(deepgramResult) {
  try {
    const transcript = deepgramResult.channel?.alternatives?.[0]?.transcript || "";
    const confidence = deepgramResult.channel?.alternatives?.[0]?.confidence || 0;
    
    return {
      text: transcript.trim(),
      confidence: confidence,
      isFinal: deepgramResult.is_final || false
    };
  } catch (err) {
    console.error("[Deepgram] Error extracting transcript:", err);
    return { text: "", confidence: 0, isFinal: false };
  }
}
