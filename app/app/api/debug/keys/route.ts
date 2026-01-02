
import { NextResponse } from 'next/server'

export async function GET() {
    const checks = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Missing',
        GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY ? 'Set' : 'Missing',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Missing',
        DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing',
    }

    // 1. Check OpenAI
    let openaiStatus = 'Skipped'
    if (process.env.OPENAI_API_KEY) {
        try {
            const { OpenAI } = await import('openai')
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
            await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 1
            })
            openaiStatus = 'Active/Valid'
        } catch (error: any) {
            openaiStatus = `Error: ${error.status || error.code || error.message}`
        }
    }

    // 2. Check Gemini
    let geminiStatus = 'Skipped'
    const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY
    if (geminiKey) {
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai')
            const genAI = new GoogleGenerativeAI(geminiKey)
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
            await model.generateContent('ping')
            geminiStatus = 'Active/Valid'
        } catch (error: any) {
            geminiStatus = `Error: ${error.message}`
        }
    }

    return NextResponse.json({
        env: checks,
        connectivity: {
            openai: openaiStatus,
            gemini: geminiStatus
        }
    })
}
