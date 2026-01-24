/**
 * Call State Management with Redis
 * Distributed state storage for horizontal scaling
 */

import redis, { getJSON, setJSON, deleteKey, getKeys, isRedisAvailable } from './config/redis.js';

// In-memory fallback for when Redis is unavailable
const memoryFallback = new Map();
const CALL_TTL = 3600; // 1 hour

/**
 * Initialize a call state for a new outbound call.
 */
export async function initCall(callSid, data = {}) {
  const callData = {
    callSid,
    status: "initiated", // initiated | in-progress | completed | failed
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    script: data.script || "",
    leadName: data.leadName || "",
    companyName: data.companyName || "",
    userId: data.userId || null,
    transcript: [],
    summary: null,
    metadata: {},
    lastUserUtterance: null,
    ...data // Include any additional fields passed in
  };

  // Try Redis first
  if (await isRedisAvailable()) {
    const success = await setJSON(`call:${callSid}`, callData, CALL_TTL);
    if (success) {
      console.log(`[CallState] Initialized call ${callSid} in Redis`);
      return callData;
    }
  }

  // Fallback to in-memory
  console.warn(`[CallState] Using in-memory fallback for call ${callSid}`);
  memoryFallback.set(callSid, callData);
  return callData;
}

/**
 * Update call state.
 */
export async function updateCall(callSid, updater) {
  // Get existing call
  const existing = await getCall(callSid);
  if (!existing) {
    console.warn(`[CallState] Call ${callSid} not found for update`);
    return null;
  }

  const updated = {
    ...existing,
    ...updater,
    updatedAt: new Date().toISOString()
  };

  // Try Redis first
  if (await isRedisAvailable()) {
    const success = await setJSON(`call:${callSid}`, updated, CALL_TTL);
    if (success) {
      return updated;
    }
  }

  // Fallback to in-memory
  memoryFallback.set(callSid, updated);
  return updated;
}

/**
 * Append a transcript entry.
 */
export async function addTranscript(callSid, entry) {
  const call = await getCall(callSid);
  if (!call) {
    console.warn(`[CallState] Call ${callSid} not found for transcript`);
    return;
  }

  const transcriptEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  };

  call.transcript.push(transcriptEntry);
  call.updatedAt = new Date().toISOString();

  // Try Redis first
  if (await isRedisAvailable()) {
    await setJSON(`call:${callSid}`, call, CALL_TTL);
  } else {
    // Fallback to in-memory
    memoryFallback.set(callSid, call);
  }
}

/**
 * Get call state.
 */
export async function getCall(callSid) {
  // Try Redis first
  if (await isRedisAvailable()) {
    const call = await getJSON(`call:${callSid}`);
    if (call) return call;
  }

  // Fallback to in-memory
  return memoryFallback.get(callSid) || null;
}

/**
 * List all calls (basic info).
 */
export async function listCalls() {
  // Try Redis first
  if (await isRedisAvailable()) {
    const keys = await getKeys('call:*');
    const calls = [];

    for (const key of keys) {
      const call = await getJSON(key);
      if (call) {
        calls.push({
          callSid: call.callSid,
          status: call.status,
          createdAt: call.createdAt,
          updatedAt: call.updatedAt,
          summary: call.summary
        });
      }
    }

    return calls;
  }

  // Fallback to in-memory
  return Array.from(memoryFallback.values()).map((c) => ({
    callSid: c.callSid,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    summary: c.summary
  }));
}

/**
 * Delete call state (cleanup after completion)
 */
export async function deleteCall(callSid) {
  // Try Redis first
  if (await isRedisAvailable()) {
    await deleteKey(`call:${callSid}`);
  }

  // Also remove from memory fallback
  memoryFallback.delete(callSid);
  console.log(`[CallState] Deleted call ${callSid}`);
}

/**
 * Get call count (for monitoring)
 */
export async function getCallCount() {
  if (await isRedisAvailable()) {
    const keys = await getKeys('call:*');
    return keys.length;
  }

  return memoryFallback.size;
}
