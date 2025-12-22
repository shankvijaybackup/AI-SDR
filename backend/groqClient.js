// Groq API Client - Ultra-fast LLM inference (~200ms vs OpenAI's 1000-1500ms)
// Groq uses LPU (Language Processing Unit) for ~10x faster inference than GPUs
// Free tier available with generous limits

import Groq from 'groq-sdk';

// Lazy initialization - only create client when actually needed
let groqClient = null;

function getGroqClient() {
    if (!groqClient && process.env.GROQ_API_KEY) {
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return groqClient;
}

// Available Groq models (all free)
const MODELS = {
    // Fast and capable (recommended for voice)
    llama70b: 'llama-3.3-70b-versatile',  // Best quality, still very fast
    llama8b: 'llama-3.1-8b-instant',       // Fastest, good for simple responses
    mixtral: 'mixtral-8x7b-32768',         // Good balance of speed and quality
};

// Default to fast 8B model for voice (fastest inference)
const DEFAULT_MODEL = MODELS.llama8b;

/**
 * Get a fast AI reply using Groq
 * Much faster than OpenAI (~200ms vs 1000-1500ms)
 * 
 * @param {object} options - Same interface as getAiSdrReply
 * @returns {Promise<string>} - AI response
 */
export async function getGroqReply({
    systemPrompt,
    userPrompt,
    maxTokens = 40,
    temperature = 0.5,
}) {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY not configured');
    }

    const startTime = Date.now();

    try {
        const client = getGroqClient();
        if (!client) {
            throw new Error('Groq client not initialized');
        }
        const completion = await client.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: maxTokens,
            temperature: temperature,
            stream: false,
        });

        const reply = completion.choices[0]?.message?.content || '';
        const elapsed = Date.now() - startTime;

        console.log(`[Groq] Reply in ${elapsed}ms: "${reply.substring(0, 50)}..."`);
        return reply.trim();

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[Groq] Error after ${elapsed}ms:`, error.message);
        throw error;
    }
}

/**
 * Build a simplified system prompt for Groq (shorter = faster)
 * Groq models benefit from shorter prompts due to faster tokenization
 */
export function buildGroqSystemPrompt(phase, voicePersona = 'Arabella') {
    return `You are ${voicePersona}, a friendly SDR at Atomicwork. You're on a phone call.

RULES:
- Respond in 1-2 SHORT sentences (max 20 words)
- Sound natural and human, not robotic
- Never say "I'm an AI" or narrate actions
- Current phase: ${phase}

${phase === 'rapport' ? 'Goal: Get permission to continue. Ask if it\'s a good time.' : ''}
${phase === 'discovery' ? 'Goal: Ask ONE discovery question about their IT tools or pain points.' : ''}
${phase === 'pitch' ? 'Goal: Briefly mention Atomicwork helps IT teams with AI automation. Ask about a demo.' : ''}
${phase === 'objection' ? 'Goal: Handle objection empathetically, offer value (free report or demo).' : ''}
${phase === 'closing' ? 'Goal: Confirm next steps and end call positively.' : ''}

Reply ONLY with what you'd say out loud. No quotes or labels.`;
}

/**
 * Check if Groq is configured and available
 */
export async function healthCheck() {
    if (!process.env.GROQ_API_KEY) {
        return { available: false, reason: 'GROQ_API_KEY not set' };
    }

    try {
        const startTime = Date.now();
        const client = getGroqClient();
        if (!client) {
            return { available: false, reason: 'Groq client not initialized' };
        }
        const completion = await client.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [{ role: 'user', content: 'Say "ok"' }],
            max_tokens: 5,
        });
        const elapsed = Date.now() - startTime;

        return {
            available: true,
            model: DEFAULT_MODEL,
            latency: `${elapsed}ms`,
        };
    } catch (error) {
        return { available: false, reason: error.message };
    }
}

export { MODELS, DEFAULT_MODEL };
