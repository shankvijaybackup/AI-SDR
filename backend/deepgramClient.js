// deepgramClient.js
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Minimum confidence threshold for accepting transcripts
export const MIN_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Create a Deepgram live transcription connection for real-time ASR
 * Optimized for phone call quality and accuracy
 */
export function createDeepgramConnection() {
  if (!DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not set");
  }

  const deepgram = createClient(DEEPGRAM_API_KEY);

  const connection = deepgram.listen.live({
    // Model optimized for phone calls
    model: "nova-2-phonecall",
    language: "en-US",

    // Quality enhancements
    smart_format: true,           // Auto-format numbers, dates, etc.
    punctuate: true,              // Add punctuation
    diarize: true,                // Speaker separation
    filler_words: true,           // Include "um", "uh" for complete transcript

    // Real-time processing
    interim_results: true,        // Get results as speech happens
    endpointing: 400,             // End utterance after 400ms silence
    utterance_end_ms: 1500,       // Max wait before forcing utterance end
    vad_events: true,             // Voice activity detection

    // Audio format (Twilio μ-law)
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
