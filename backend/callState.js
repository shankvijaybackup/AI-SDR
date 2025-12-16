// In-memory store for calls. For production, move this to Redis/DB.
const calls = new Map();

/**
 * Initialize a call state for a new outbound call.
 */
export function initCall(callSid, data = {}) {
  if (!calls.has(callSid)) {
    calls.set(callSid, {
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
      lastUserUtterance: null
    });
  }
  return calls.get(callSid);
}

/**
 * Update call state.
 */
export function updateCall(callSid, updater) {
  const existing = calls.get(callSid);
  if (!existing) return;
  const updated = {
    ...existing,
    ...updater,
    updatedAt: new Date().toISOString()
  };
  calls.set(callSid, updated);
  return updated;
}

/**
 * Append a transcript entry.
 */
export function addTranscript(callSid, entry) {
  const call = calls.get(callSid);
  if (!call) return;
  call.transcript.push({
    timestamp: new Date().toISOString(),
    ...entry
  });
  call.updatedAt = new Date().toISOString();
}

/**
 * Get call state.
 */
export function getCall(callSid) {
  return calls.get(callSid) || null;
}

/**
 * List all calls (basic info).
 */
export function listCalls() {
  return Array.from(calls.values()).map((c) => ({
    callSid: c.callSid,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    summary: c.summary
  }));
}
