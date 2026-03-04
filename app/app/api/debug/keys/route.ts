
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    const checks = {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'Set' : 'Missing',
        GROQ_API_KEY: process.env.GROQ_API_KEY ? 'Set' : 'Missing',
        VOYAGE_API_KEY: process.env.VOYAGE_API_KEY ? 'Set' : 'Missing',
        DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing',
    }

    // 1. Check Anthropic
    let anthropicStatus = 'Skipped'
    if (process.env.ANTHROPIC_API_KEY) {
        try {
            const Anthropic = (await import('@anthropic-ai/sdk')).default
            const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
            await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'ping' }],
            })
            anthropicStatus = 'Active/Valid'
        } catch (error: any) {
            anthropicStatus = `Error: ${error.status || error.code || error.message}`
        }
    }

    // 2. Check Groq
    let groqStatus = 'Skipped'
    if (process.env.GROQ_API_KEY) {
        try {
            const Groq = (await import('groq-sdk')).default
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
            await groq.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 1,
            })
            groqStatus = 'Active/Valid'
        } catch (error: any) {
            groqStatus = `Error: ${error.status || error.code || error.message}`
        }
    }

    // 3. Check Voyage AI
    let voyageStatus = 'Skipped'
    if (process.env.VOYAGE_API_KEY) {
        try {
            const { VoyageAIClient } = await import('voyageai')
            const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })
            await client.embed({ input: ['ping'], model: 'voyage-3' })
            voyageStatus = 'Active/Valid'
        } catch (error: any) {
            voyageStatus = `Error: ${error.status || error.code || error.message}`
        }
    }

    return NextResponse.json({
        env: checks,
        connectivity: {
            anthropic: anthropicStatus,
            groq: groqStatus,
            voyage: voyageStatus,
        }
    })
}
