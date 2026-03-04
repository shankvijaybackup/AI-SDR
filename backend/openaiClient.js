// backend/openaiClient.js
// MIGRATION SHIM — all OpenAI calls replaced with Groq (primary) + Claude (fallback)
// This file exists only for backward compatibility with server.js imports.
// TODO: update server.js imports to use claudeClient.js directly.

export { getAiSdrReply, summarizeCall, claudeReply, healthCheck } from './claudeClient.js';
