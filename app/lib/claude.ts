// lib/claude.ts
// Anthropic Claude client for frontend (Next.js server actions / API routes)
// Replaces lib/gemini.ts

import Anthropic from '@anthropic-ai/sdk'

const CLAUDE_MODELS = {
  haiku:  'claude-haiku-4-5-20251001',  // Fast + cheap
  sonnet: 'claude-sonnet-4-6',           // Balanced
  opus:   'claude-opus-4-6',            // Best quality
}

function getClient(apiKey?: string) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('Missing ANTHROPIC_API_KEY')
  return new Anthropic({ apiKey: key })
}

export interface ClaudeOptions {
  apiKey?: string
  model?: keyof typeof CLAUDE_MODELS
  maxTokens?: number
  temperature?: number
  system?: string
}

/**
 * Generate text content from a prompt.
 * Returns the text string directly.
 */
export async function generateContent(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const client = getClient(options.apiKey)
  const model = CLAUDE_MODELS[options.model || 'sonnet']

  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.7,
    system: options.system,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0]?.text || ''
}

/**
 * Generate JSON content. Parses and returns the object.
 * Throws if the response cannot be parsed as JSON.
 */
export async function generateJSON<T = unknown>(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<T> {
  const text = await generateContent(
    prompt + '\n\nIMPORTANT: Reply ONLY with valid JSON. No markdown, no commentary.',
    { ...options, model: options.model || 'sonnet' }
  )
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  return JSON.parse(match ? match[0] : text) as T
}

export { CLAUDE_MODELS }
