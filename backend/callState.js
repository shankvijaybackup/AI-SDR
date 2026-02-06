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
    console.error(`[CallState TRANSCRIPT] ❌ CRITICAL: Call ${callSid} not found for transcript! Entry lost:`, entry);
    return;
  }

  const transcriptEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  };

  // COMPREHENSIVE LOGGING - Log every single word captured
  console.log(`[CallState TRANSCRIPT] ✅ CAPTURED for ${callSid}:`);
  console.log(`  Speaker: ${transcriptEntry.speaker}`);
  console.log(`  Text: "${transcriptEntry.text}"`);
  console.log(`  Text Length: ${transcriptEntry.text?.length || 0} characters`);
  console.log(`  Timestamp: ${transcriptEntry.timestamp}`);
  console.log(`  Word Count: ${transcriptEntry.text?.split(/\s+/).length || 0} words`);

  // Add to transcript array
  const previousLength = call.transcript.length;
  call.transcript.push(transcriptEntry);
  const newLength = call.transcript.length;

  console.log(`  Transcript Array: ${previousLength} → ${newLength} entries (CONFIRMED PUSH)`);
  call.updatedAt = new Date().toISOString();

  // Try Redis first
  if (await isRedisAvailable()) {
    const success = await setJSON(`call:${callSid}`, call, CALL_TTL);
    if (success) {
      console.log(`  Storage: ✅ SAVED TO REDIS (${newLength} total entries)`);
    } else {
      console.error(`  Storage: ❌ REDIS SAVE FAILED! Falling back to memory`);
      memoryFallback.set(callSid, call);
      console.log(`  Storage: ✅ SAVED TO MEMORY (fallback)`);
    }
  } else {
    // Fallback to in-memory
    memoryFallback.set(callSid, call);
    console.log(`  Storage: ✅ SAVED TO MEMORY (${newLength} total entries)`);
  }

  // Final verification
  console.log(`[CallState TRANSCRIPT] 📊 Call ${callSid} now has ${call.transcript.length} total transcript entries\n`);
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
