/**
 * Cartesia TTS Client - Ultra-Low Latency TTS (~40ms Time to First Audio)
 * 
 * Cartesia Sonic is the fastest TTS available with:
 * - 40ms Time to First Audio (Sonic Turbo)
 * - 90ms for Sonic 2
 * - Streaming support for real-time voice
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_API_URL = 'https://api.cartesia.ai/tts/bytes';

// Default voice IDs for Cartesia
// Get voice IDs from: https://play.cartesia.ai/
const CARTESIA_VOICES = {
    female_professional: 'a0e99841-438c-4a64-b679-ae501e7d6091', // Professional female
    male_professional: '79a125e8-cd45-4c13-8a67-188112f4dd22', // Professional male
    female_warm: '694f9389-aac1-45b6-b726-9d9369183238', // Warm female
    male_casual: '2ee87190-8f84-4925-97da-e52547f9462c', // Casual male
};

// TTS directory for storing audio files
const TTS_DIR = path.join(process.cwd(), 'tts');

// Ensure TTS directory exists
if (!fs.existsSync(TTS_DIR)) {
    fs.mkdirSync(TTS_DIR, { recursive: true });
}

/**
 * Synthesize speech using Cartesia's ultra-low latency TTS
 * 
 * @param {string} text - Text to synthesize
 * @param {string} callSid - Call SID for file naming
 * @param {object} options - TTS options
 * @returns {Promise<string>} - Public URL to the audio file
 */
export async function synthesizeWithCartesia(text, callSid, options = {}) {
    if (!CARTESIA_API_KEY) {
        throw new Error('CARTESIA_API_KEY is not set');
    }

    const startTime = Date.now();

    // Select voice based on options
    const voiceId = options.voiceId || CARTESIA_VOICES.female_professional;

    // Truncate text for faster synthesis (voice calls should be short)
    const truncatedText = text.length > 200 ? text.substring(0, 200) : text;

    console.log(`[Cartesia] Synthesizing: "${truncatedText.substring(0, 50)}..."`);

    try {
        const response = await fetch(CARTESIA_API_URL, {
            method: 'POST',
            headers: {
                'X-API-Key': CARTESIA_API_KEY,
                'Cartesia-Version': '2024-06-10',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model_id: 'sonic-2', // or 'sonic-turbo' for even faster
                transcript: truncatedText,
                voice: {
                    mode: 'id',
                    id: voiceId,
                },
                output_format: {
                    container: 'mp3',
                    encoding: 'mp3',
                    sample_rate: 24000,
                },
                language: 'en',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Cartesia] API Error:', response.status, errorText);
            throw new Error(`Cartesia API error: ${response.status}`);
        }

        // Get audio buffer
        const audioBuffer = await response.buffer();

        // Save to file
        const id = randomUUID();
        const filename = `${id}.mp3`;
        const filepath = path.join(TTS_DIR, filename);

        fs.writeFileSync(filepath, audioBuffer);

        const elapsed = Date.now() - startTime;
        console.log(`[Cartesia] TTS completed in ${elapsed}ms`);

        // Return public URL
        const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
        const publicUrl = `${PUBLIC_BASE_URL}/tts/${filename}`;

        return publicUrl;
    } catch (error) {
        console.error('[Cartesia] Error:', error);
        throw error;
    }
}

/**
 * Synthesize with streaming for even lower latency
 * Returns chunks as they become available
 */
export async function synthesizeWithCartesiaStreaming(text, callSid, onChunk) {
    if (!CARTESIA_API_KEY) {
        throw new Error('CARTESIA_API_KEY is not set');
    }

    const startTime = Date.now();
    const voiceId = CARTESIA_VOICES.female_professional;

    console.log(`[Cartesia Stream] Starting: "${text.substring(0, 50)}..."`);

    const response = await fetch('https://api.cartesia.ai/tts/sse', {
        method: 'POST',
        headers: {
            'X-API-Key': CARTESIA_API_KEY,
            'Cartesia-Version': '2024-06-10',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model_id: 'sonic-turbo', // Fastest model for streaming
            transcript: text,
            voice: {
                mode: 'id',
                id: voiceId,
            },
            output_format: {
                container: 'raw',
                encoding: 'pcm_s16le',
                sample_rate: 24000,
            },
            language: 'en',
        }),
    });

    if (!response.ok) {
        throw new Error(`Cartesia streaming error: ${response.status}`);
    }

    // Process SSE stream
    const reader = response.body;
    const chunks = [];
    let firstChunkTime = null;

    return new Promise((resolve, reject) => {
        reader.on('data', (chunk) => {
            if (!firstChunkTime) {
                firstChunkTime = Date.now() - startTime;
                console.log(`[Cartesia Stream] First chunk in ${firstChunkTime}ms`);
            }
            chunks.push(chunk);
            if (onChunk) onChunk(chunk);
        });

        reader.on('end', () => {
            const totalTime = Date.now() - startTime;
            console.log(`[Cartesia Stream] Complete in ${totalTime}ms`);
            resolve(Buffer.concat(chunks));
        });

        reader.on('error', reject);
    });
}

/**
 * Get a Cartesia voice ID based on persona
 */
export function getCartesiaVoice(persona = 'female_professional') {
    return CARTESIA_VOICES[persona] || CARTESIA_VOICES.female_professional;
}

export default {
    synthesizeWithCartesia,
    synthesizeWithCartesiaStreaming,
    getCartesiaVoice,
    CARTESIA_VOICES,
};
