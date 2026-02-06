import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { generateContentSafe } from '@/lib/gemini'

// Initialize both AI clients
// Initialize both AI clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '', // Don't crash if missing, handle later
})

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // 1. Strict Environment Check
        const hasGeminiKey = !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY)
        if (!hasGeminiKey) {
            console.error('[Script Gen] GOOGLE_AI_API_KEY / GEMINI_API_KEY is missing.')
            return NextResponse.json({
                error: 'Service Misconfigured: AI API Key is missing. Please check server settings.'
            }, { status: 503 })
        }

        const { knowledgeSourceIds, scriptType, targetPersona } = await request.json()

        if (!knowledgeSourceIds || knowledgeSourceIds.length === 0) {
            return NextResponse.json({ error: 'Please select at least one knowledge source' }, { status: 400 })
        }

        // Fetch the selected knowledge sources
        const knowledgeSources = await prisma.knowledgeSource.findMany({
            where: {
                id: { in: knowledgeSourceIds },
                OR: [
                    { userId: currentUser.userId },
                    { createdBy: currentUser.userId }, // Include user-created shared files
                    { isShared: true },
                ],
            },
            select: {
                id: true,
                title: true,
                description: true,
                summary: true,
                content: true,
                chunks: true,
            },
        })

        if (knowledgeSources.length === 0) {
            return NextResponse.json({ error: 'No knowledge sources found' }, { status: 404 })
        }

        // Compile knowledge content
        const knowledgeContent = knowledgeSources.map((source) => {
            let content = `## ${source.title}\n`
            if (source.description) content += `${source.description}\n`
            if (source.summary) content += `Summary: ${source.summary}\n`

            if (source.content) {
                content += `\nContent:\n${source.content.slice(0, 8000)}` // Increased context for Flash
            } else if (source.chunks && Array.isArray(source.chunks)) {
                // Use more chunks if valid
                const chunkTexts = (source.chunks as any[]).slice(0, 20).map((c: any) => c.text || c.content || '').join('\n')
                content += `\nContent:\n${chunkTexts}`
            }

            return content
        }).join('\n\n---\n\n')

        // Determine script type prompt
        const scriptTypePrompts: Record<string, string> = {
            'cold_call': 'cold call opening script for prospects who have never heard of the company',
            'follow_up': 'follow-up call script for prospects who have shown initial interest',
            'demo': 'demo call script to showcase product features and benefits',
            'objection': 'objection handling script with responses to common concerns',
            'closing': 'closing script to convert interested prospects into customers',
        }

        const scriptTypeDesc = scriptTypePrompts[scriptType] || 'general sales call script'

        // Build the base prompt
        const basePrompt = `Based on this knowledge about a product/company, create a professional ${scriptTypeDesc}.

TARGET PERSONA: ${targetPersona || 'B2B decision makers'}

KNOWLEDGE BASE CONTENT:
${knowledgeContent.slice(0, 500000)}

REQUIREMENTS:
- Natural, conversational tone (not robotic)
- Include placeholders: {{firstName}}, {{lastName}}, {{company}}, {{jobTitle}}, {{repName}}
- Strong opening hook
- Key value propositions from the knowledge base
- Clear call-to-action
- 200-400 words
${scriptType === 'objection' ? '- Include 3-5 common objections with responses' : ''}`

        console.log('[Script Gen] Using AI approach...')

        let generatedScript = ''
        let generatedWith = 'gemini-only'

        // Step 1: Gemini Generation
        try {
            const geminiResult = await generateContentSafe(
                `You are a sales script expert. ${basePrompt}\n\nGenerate ONLY the script content, no commentary.`
            )
            generatedScript = geminiResult.response.text()
            console.log('[Script Gen] ✅ Gemini draft generated')
        } catch (geminiError) {
            console.error('[Script Gen] ⚠️ Gemini failed:', geminiError)
            return NextResponse.json({
                error: 'AI Service Error: Failed to generate content. Please check quotas or validity of GOOGLE_AI_API_KEY.'
            }, { status: 502 }) // Bad Gateway / Upstream error
        }

        // Step 2: Optional OpenAI Refinement (Only if key exists and previous step succeeded)
        // We skip this if OpenAI key is likely busted or missing, to avoid 429
        if (process.env.OPENAI_API_KEY && generatedScript) {
            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are an expert sales script writer. Output only the script.' },
                        { role: 'user', content: `Refine this script to be more natural:\n\n${generatedScript}` }
                    ],
                    temperature: 0.7,
                    max_tokens: 1500,
                })
                generatedScript = completion.choices[0]?.message?.content || generatedScript
                generatedWith = 'gemini+openai'
                console.log('[Script Gen] ✅ OpenAI refinement complete')
            } catch (openaiError: any) {
                console.warn('[Script Gen] ⚠️ OpenAI refinement skipped (quota/error):', openaiError.status || openaiError.message)
                // Do not fail the request, just use Gemini output
            }
        }

        // Generate a suggested name for the script
        const firstSource = knowledgeSources[0]
        const scriptTypeLabel = scriptType
            ? scriptType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
            : 'AI Generated'
        const suggestedName = `${scriptTypeLabel} Script - ${firstSource.title.slice(0, 30)}`

        return NextResponse.json({
            success: true,
            script: {
                name: suggestedName,
                content: generatedScript,
                sources: knowledgeSources.map((s) => ({ id: s.id, title: s.title })),
                generatedWith,
            },
        })

    } catch (error) {
        console.error('Error generating script:', error)
        return NextResponse.json({ error: 'Failed to generate script: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
    }
}
