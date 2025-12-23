import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize both AI clients
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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
                content += `\nContent:\n${source.content.slice(0, 5000)}`
            } else if (source.chunks && Array.isArray(source.chunks)) {
                const chunkTexts = (source.chunks as any[]).slice(0, 10).map((c: any) => c.text || c.content || '').join('\n')
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
${knowledgeContent}

REQUIREMENTS:
- Natural, conversational tone (not robotic)
- Include placeholders: {{firstName}}, {{lastName}}, {{company}}, {{jobTitle}}, {{repName}}
- Strong opening hook
- Key value propositions from the knowledge base
- Clear call-to-action
- 200-400 words
${scriptType === 'objection' ? '- Include 3-5 common objections with responses' : ''}`

        console.log('[Script Gen] Using hybrid AI approach (Gemini + OpenAI)...')

        // HYBRID APPROACH: Use both models and combine insights
        let geminiScript = ''
        let openaiScript = ''

        // Step 1: Generate initial draft with Gemini (fast, creative)
        try {
            const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
            const geminiResult = await geminiModel.generateContent(
                `You are a sales script expert. ${basePrompt}\n\nGenerate ONLY the script content, no commentary.`
            )
            geminiScript = geminiResult.response.text()
            console.log('[Script Gen] ✅ Gemini draft generated')
        } catch (geminiError) {
            console.log('[Script Gen] ⚠️ Gemini failed, falling back to OpenAI only:', geminiError)
        }

        // Step 2: Refine with OpenAI (polish, structure)
        const openaiPrompt = geminiScript
            ? `You are a senior sales coach. Review and improve this sales script draft, making it more natural and effective while keeping its structure. Fix any awkward phrasing.

DRAFT SCRIPT:
${geminiScript}

CONTEXT:
${basePrompt}

Return ONLY the improved script, no commentary.`
            : `You are an expert sales script writer. ${basePrompt}\n\nGenerate ONLY the script content, no commentary.`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are an expert sales script writer who creates natural, effective sales scripts. Output only the script, no meta-commentary.' },
                { role: 'user', content: openaiPrompt }
            ],
            temperature: 0.7,
            max_tokens: 1500,
        })

        openaiScript = completion.choices[0]?.message?.content || ''
        console.log('[Script Gen] ✅ OpenAI refinement complete')

        // Use the final refined script
        const generatedScript = openaiScript

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
                generatedWith: geminiScript ? 'gemini+openai' : 'openai-only',
            },
        })

    } catch (error) {
        console.error('Error generating script:', error)
        return NextResponse.json({ error: 'Failed to generate script' }, { status: 500 })
    }
}
