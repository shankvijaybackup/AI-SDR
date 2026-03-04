// backend/voyageClient.js
// Voyage AI embeddings — replaces OpenAI text-embedding-3-small
// Voyage-3 produces 1024-dimensional embeddings
// NOTE: existing stored chunk embeddings (1536-dim OpenAI) need re-indexing
//       Run: npm run reindex-embeddings after deploying

import { VoyageAIClient } from "voyageai";

const VOYAGE_MODEL = "voyage-3";

let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY not set");
    _client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  }
  return _client;
}

/**
 * Embed a single string or array of strings.
 * Returns an array of float arrays (one per input).
 */
export async function embed(input) {
  const inputs = Array.isArray(input) ? input : [input];
  const client = getClient();
  const result = await client.embed({
    input: inputs,
    model: VOYAGE_MODEL,
  });
  return result.data.map(d => d.embedding);
}

/**
 * Embed a single query string. Returns a single float[].
 */
export async function embedQuery(text) {
  const [embedding] = await embed(text);
  return embedding;
}

/**
 * Embed an array of document chunks. Returns float[][].
 * Batches automatically to stay within Voyage rate limits (128 texts / request).
 */
export async function embedDocuments(texts) {
  const BATCH_SIZE = 128;
  const results = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embed(batch);
    results.push(...embeddings);
  }
  return results;
}

export async function healthCheck() {
  if (!process.env.VOYAGE_API_KEY) {
    return { available: false, reason: "VOYAGE_API_KEY not set" };
  }
  try {
    const start = Date.now();
    await embedQuery("health check");
    return { available: true, model: VOYAGE_MODEL, latency: `${Date.now() - start}ms` };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

export { VOYAGE_MODEL };
