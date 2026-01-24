/**
 * Voice Mapping Storage with Redis
 * Maps call SIDs to voice IDs for consistent voice selection
 */

import redis, { getJSON, setJSON, isRedisAvailable } from './config/redis.js';

// In-memory fallback
const memoryFallback = new Map();
const VOICE_TTL = 7200; // 2 hours

/**
 * Set voice for a call
 */
export async function setVoiceForCall(callSid, voiceId) {
    // Try Redis first
    if (await isRedisAvailable()) {
        await setJSON(`voice:${callSid}`, { voiceId, callSid }, VOICE_TTL);
        console.log(`[VoiceMap] Set voice ${voiceId} for call ${callSid} in Redis`);
        return;
    }

    // Fallback to in-memory
    memoryFallback.set(callSid, voiceId);
    console.log(`[VoiceMap] Set voice ${voiceId} for call ${callSid} (in-memory fallback)`);
}

/**
 * Get voice for a call
 */
export async function getVoiceForCall(callSid) {
    // Try Redis first
    if (await isRedisAvailable()) {
        const data = await getJSON(`voice:${callSid}`);
        return data?.voiceId || null;
    }

    // Fallback to in-memory
    return memoryFallback.get(callSid) || null;
}

/**
 * Delete voice mapping (cleanup)
 */
export async function deleteVoiceMapping(callSid) {
    if (await isRedisAvailable()) {
        await redis.del(`voice:${callSid}`);
    }
    memoryFallback.delete(callSid);
}
