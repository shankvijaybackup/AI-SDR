import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateContent } from '@/lib/claude'

export async function POST(request: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Strict Environment Check
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('[Script Gen] ANTHROPIC_API_KEY is missing.')
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
                    { createdBy: currentUser.userId },
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
                content += `\nContent:\n${source.content.slice(0, 8000)}`
            } else if (source.chunks && Array.isArray(source.chunks)) {
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

        const prompt = `Based on this knowledge about a product/company, create a professional ${scriptTypeDesc}.

TARGET PERSONA: ${targetPersona || 'B2B decision makers'}

KNOWLEDGE BASE CONTENT:
${knowledgeContent.slice(0, 50000)}

REQUIREMENTS:
- Natural, conversational tone (not robotic)
- Include placeholders: {{firstName}}, {{lastName}}, {{company}}, {{jobTitle}}, {{repName}}
- Strong opening hook
- Key value propositions from the knowledge base
- Clear call-to-action
- 200-400 words
${scriptType === 'objection' ? '- Include 3-5 common objections with responses' : ''}

Generate ONLY the script content, no commentary.`

        console.log('[Script Gen] Generating with Claude Sonnet...')

        const generatedScript = await generateContent(prompt, {
            model: 'sonnet',
            system: 'You are an expert sales script writer. Output only the script content, no explanations or commentary.',
            maxTokens: 1500,
            temperature: 0.7,
        })

        if (!generatedScript) {
            return NextResponse.json({ error: 'Failed to generate script content' }, { status: 502 })
        }

        console.log('[Script Gen] ✅ Claude Sonnet script generated')

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
                generatedWith: 'claude-sonnet',
            },
        })

    } catch (error) {
        console.error('Error generating script:', error)
        return NextResponse.json({ error: 'Failed to generate script: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
    }
}
