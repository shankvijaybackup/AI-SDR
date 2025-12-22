// Deepgram TTS Client - Ultra-low latency text-to-speech
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const TTS_DIR = path.join(process.cwd(), 'tts_files');

// Available Deepgram voices - aura models are fast and natural
const VOICES = {
    // Female voices
    asteria: 'aura-asteria-en',    // Warm, professional female
    stella: 'aura-stella-en',      // Friendly female
    athena: 'aura-athena-en',      // Confident female
    hera: 'aura-hera-en',          // Authoritative female
    luna: 'aura-luna-en',          // Gentle female

    // Male voices  
    orion: 'aura-orion-en',        // Professional male
    arcas: 'aura-arcas-en',        // Friendly male
    perseus: 'aura-perseus-en',    // Deep male
    angus: 'aura-angus-en',        // Warm male
    helios: 'aura-helios-en',      // Energetic male
};

// Default voice for SDR calls (professional female)
const DEFAULT_VOICE = VOICES.asteria;

/**
 * Map ElevenLabs voice names to Deepgram equivalents
 */
function mapVoiceToDeepgram(voicePersona) {
    const mappings = {
        'Arabella': VOICES.asteria,
        'Anika': VOICES.stella,
        'Jane': VOICES.luna,
        'Brandon': VOICES.orion,
        'Adam': VOICES.arcas,
    };
    return mappings[voicePersona] || DEFAULT_VOICE;
}

/**
 * Synthesize speech using Deepgram Aura TTS
 * Much faster than ElevenLabs (~100-200ms vs 400-600ms)
 * 
 * @param {string} text - Text to synthesize
 * @param {string} callSid - Call identifier for logging
 * @param {string} voicePersona - Voice persona name (maps to Deepgram voice)
 * @returns {Promise<string>} - URL of the generated audio file
 */
export async function synthesizeWithDeepgram(text, callSid, voicePersona = null) {
    if (!DEEPGRAM_API_KEY) {
        throw new Error('DEEPGRAM_API_KEY not configured');
    }

    const startTime = Date.now();
    const voice = voicePersona ? mapVoiceToDeepgram(voicePersona) : DEFAULT_VOICE;

    // Truncate to keep responses snappy (max 200 chars)
    const truncatedText = text.length > 200 ? text.substring(0, 200) : text;

    console.log(`[Deepgram TTS] Synthesizing with ${voice}: "${truncatedText.substring(0, 50)}..."`);

    try {
        const response = await fetch(
            `https://api.deepgram.com/v1/speak?model=${voice}&encoding=mp3`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: truncatedText }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Deepgram TTS] Error ${response.status}:`, errorText);
            throw new Error(`Deepgram TTS failed: ${response.status}`);
        }

        // Get audio buffer
        const audioBuffer = Buffer.from(await response.arrayBuffer());

        // Save to file
        const id = randomUUID();
        const filename = `${id}.mp3`;
        const filepath = path.join(TTS_DIR, filename);

        await fs.promises.writeFile(filepath, audioBuffer);

        const publicUrl = `${PUBLIC_BASE_URL}/tts/${filename}`;
        const elapsed = Date.now() - startTime;

        console.log(`[Deepgram TTS] Audio ready in ${elapsed}ms: ${publicUrl}`);
        return publicUrl;

    } catch (error) {
        console.error('[Deepgram TTS] Error:', error.message);
        throw error;
    }
}

/**
 * Check if Deepgram is configured and working
 */
export async function healthCheck() {
    if (!DEEPGRAM_API_KEY) {
        return { available: false, reason: 'DEEPGRAM_API_KEY not set' };
    }

    try {
        // Quick test with minimal text
        const response = await fetch(
            'https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mp3',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: 'Test' }),
            }
        );

        return { available: response.ok, status: response.status };
    } catch (error) {
        return { available: false, reason: error.message };
    }
}

export { VOICES, DEFAULT_VOICE };
