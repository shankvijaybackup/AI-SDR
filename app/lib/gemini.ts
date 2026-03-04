// lib/gemini.ts
// MIGRATION SHIM — Gemini removed, re-exports Claude wrappers
// Existing callers using generateContentSafe() will continue to work.
// TODO: migrate callers to import from '@/lib/claude' directly.

import { generateContent } from '@/lib/claude'

export interface GeminiRequestOptions {
  apiKey?: string
  systemInstruction?: string
  jsonMode?: boolean
}

/**
 * Drop-in replacement for the old generateContentSafe().
 * Returns an object with a .response.text() method for backward compatibility.
 */
export async function generateContentSafe(
  prompt: string,
  options: GeminiRequestOptions = {}
): Promise<{ response: { text: () => string } }> {
  const jsonHint = options.jsonMode
    ? '\n\nIMPORTANT: Reply ONLY with valid JSON. No markdown, no commentary.'
    : ''

  const text = await generateContent(prompt + jsonHint, {
    system: options.systemInstruction,
  })

  return {
    response: {
      text: () => text,
    },
  }
}
