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
 * Includes speaker diarization support
 */
export function extractTranscript(deepgramResult) {
  try {
    const alternative = deepgramResult.channel?.alternatives?.[0];
    const transcript = alternative?.transcript || "";
    const confidence = alternative?.confidence || 0;

    // Extract speaker info from diarization
    const words = alternative?.words || [];
    let speakerId = null;
    if (words.length > 0 && words[0].speaker !== undefined) {
      // Get the most common speaker in this utterance
      const speakerCounts = {};
      words.forEach(w => {
        if (w.speaker !== undefined) {
          speakerCounts[w.speaker] = (speakerCounts[w.speaker] || 0) + 1;
        }
      });
      speakerId = Object.entries(speakerCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
    }

    return {
      text: transcript.trim(),
      confidence: confidence,
      isFinal: deepgramResult.is_final || false,
      speaker: speakerId !== null ? parseInt(speakerId) : null,
      startTime: words[0]?.start || null,
      endTime: words[words.length - 1]?.end || null
    };
  } catch (err) {
    console.error("[Deepgram] Error extracting transcript:", err);
    return { text: "", confidence: 0, isFinal: false, speaker: null };
  }
}

/**
 * Clean up and normalize transcript text
 * Removes artifacts, fixes common ASR errors, normalizes spacing
 */
export function cleanTranscriptText(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // Remove repetitive filler words (keep one, remove duplicates)
  cleaned = cleaned.replace(/\b(um|uh|like|you know)\s+\1+\b/gi, '$1');

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  // Fix common ASR misrecognitions for business terms
  const corrections = {
    'atomicwork': 'Atomicwork',
    'ai sdr': 'AI SDR',
    'sdr': 'SDR',
  };

  Object.entries(corrections).forEach(([wrong, right]) => {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    cleaned = cleaned.replace(regex, right);
  });

  // Ensure proper sentence capitalization
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return cleaned;
}

/**
 * Validate a transcript array for completeness and quality
 * Returns cleaned transcript with quality metrics
 */
export function validateTranscript(transcriptArray) {
  if (!Array.isArray(transcriptArray)) {
    return { valid: false, transcript: [], quality: 0 - 0, issues: ['Invalid transcript format'] };
  }

  const issues = [];
  let totalConfidence = 0;
  let confidenceCount = 0;

  const cleanedTranscript = transcriptArray
    .filter(entry => {
      // Remove empty entries
      if (!entry.text || entry.text.trim().length === 0) {
        return false;
      }
      // Remove very short noise
      if (entry.text.trim().length < 2) {
        return false;
      }
      return true;
    })
    .map(entry => {
      // Track confidence
      if (entry.confidence) {
        totalConfidence += entry.confidence;
        confidenceCount++;
      }

      return {
        ...entry,
        text: cleanTranscriptText(entry.text)
      };
    });

  // Calculate quality score
  const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
  const entriesPerMinute = cleanedTranscript.length; // Rough metric

  // Quality is based on confidence and having reasonable content
  let quality = avgConfidence;
  if (cleanedTranscript.length < 3) {
    quality *= 0.5;
    issues.push('Very short transcript');
  }

  return {
    valid: cleanedTranscript.length > 0,
    transcript: cleanedTranscript,
    quality: Math.round(quality * 100) / 100,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    issues
  };
}
