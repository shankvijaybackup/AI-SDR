import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateContent } from '@/lib/claude'

// ─── Standard Atomicwork Brand Context ────────────────────────────────────────
// These credibility points should be woven SUBTLY into every generated script.
// Don't recite them as a list — use 1-2 naturally in the opener or value section.
const ATOMICWORK_BRAND_CONTEXT = `
ATOMICWORK — STANDARD CREDIBILITY TALKING POINTS
(Weave these in naturally — never recite as a list. Use 1-2 max per script section.)

WHAT WE DO:
Atomicwork is an AI-native ITSM and ESM platform — built for the way employees actually work.
Unlike legacy tools with bolt-on AI, we are AI-native from the ground up.
We bring IT, HR, and Finance service teams into one unified platform.
Employees get help where they already are: Microsoft Teams, Slack, Voice, and Vision AI.

KEY DIFFERENTIATOR (use this framing):
"We're not adding AI to an old system — we built the whole thing around AI.
That's why companies see 80%+ ticket deflection and 10x faster resolution."

MULTI-MODAL AI:
We support Voice AI and Vision AI — employees can literally talk to or show their issue to get help.
Not just chat. Full multi-modal support.

FOUNDING TEAM CREDIBILITY (use briefly — one line, builds trust fast):
- Vijay Rayapati (CEO): Ex-Nutanix GM
- Kiran Darisi (CTO) & Parsuram Vijayasankar (Chief Designer): Co-founders of Freshworks ($13B IPO)
One-liner: "We're built by the team that built Freshworks and scaled Nutanix."

FUNDING & VALIDATION (use to establish credibility, not to brag):
- $40M raised — $25M Series A led by Khosla Ventures (Jan 2025)
- $3M from 40+ global CIOs and CTOs — the buyers themselves bet on us
One-liner: "We're backed by Khosla Ventures and over 40 global CIOs who use and invest in us."

CUSTOMER PROOF (use the most relevant one for the prospect's industry):
- Financial Services: Pepper Money (ANZ, 2,038 users), Zuora (USA, 1,842 users)
- Government / Public Sector: icare NSW (ANZ, 5,000 users), SIA
- Life Sciences / Pharma: Structure Therapeutics (USA), Abzena (UK)
- Technology / SaaS: Skydio, Blackline Group, HighRadius (4,090 users), High Level (3,202 users)
- Healthcare: AVMC (USA, 7,487 users)
- Media / Ad Tech: oOh!media (ANZ, 800 users)
One-liner: "Companies like Pepper Money, Zuora, Skydio, and Blackline are already running on Atomicwork."

CALL BEHAVIOR RULES (critical — always enforce these in scripts):
1. LISTEN FIRST — Ask one good question, then STOP and listen. Don't steamroll.
   Include [Wait — let them respond] or [Listen fully before continuing] at key moments.
2. BE POLITE AND CONSULTATIVE — This is a conversation, not a pitch. Match their energy.
3. IF THEY SAY NO — Do NOT push. Gracefully exit with:
   "Completely understand. Can I send you a quick email with a one-pager so you have it
   when the timing's right? No pressure at all." Then end the call warmly.
4. NEVER oversell or overpitch — If they're not interested, respect that immediately.
5. ONE ASK PER CALL — Only ask for ONE thing (meeting OR email). Not both.
`

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

        // Knowledge sources are OPTIONAL — brand context is always injected.
        // If sources are provided, fetch them for additional product-specific detail.
        let knowledgeSources: any[] = []
        if (knowledgeSourceIds && knowledgeSourceIds.length > 0) {
            knowledgeSources = await prisma.knowledgeSource.findMany({
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
        }

        // Compile knowledge content (empty string if no sources — brand context covers baseline)
        const knowledgeContent = knowledgeSources.length > 0
            ? knowledgeSources.map((source) => {
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
            : '(No additional knowledge sources selected — using standard brand context below)'

        // Type-specific structure instructions
        const structureMap: Record<string, string> = {
            cold_call: `Use the proven 4-part cold call structure:
1. OPENER — Pattern interrupt + ask permission ("Hi {{firstName}}, I know I'm an interruption. Do you have 27 seconds to tell me if I should hang up?")
2. HOOK — Problem-first statement specific to their role/industry. Make them nod. Never lead with the product name.
3. VALUE DRIVERS — Three tight proof points: Speed (resolution time), Cost (TCO/savings), Experience (employee satisfaction). Add one customer reference.
4. THE ASK — Soft close: "Would you be opposed to a 15-minute call to see how [similar company] solved this?"`,
            follow_up: `Structure as a warm follow-up:
1. OPENER — Reference the previous touchpoint specifically
2. BRIDGE — "Since we last spoke..." tie to a relevant industry event or pain trigger
3. NEW VALUE — One new proof point or customer story not mentioned before
4. NEXT STEP — Concrete, time-boxed ask for a meeting or demo`,
            demo: `Structure as a demo prep script:
1. AGENDA SET — Confirm goals and success criteria at the start
2. DISCOVERY RECAP — Reference their stated pain points from the discovery call
3. TAILORED DEMO FLOW — Map each feature directly to their stated pain
4. PROOF MOMENT — Drop a comparable customer result at the key demo moment
5. NEXT STEP — "Based on what you've seen, what would it take to move forward?"`,
            objection: `Create an objection handling guide with 5 common objections:
For each: State the objection → Acknowledge it → Reframe → Provide proof → Re-ask
Cover: (1) We already have an ITSM tool, (2) No budget right now, (3) Send me info, (4) Not the right time, (5) Need to involve [other person]`,
            closing: `Structure as a closing call script:
1. OPEN WITH MOMENTUM — Reference all prior positive signals
2. HANDLE FINAL OBJECTIONS — Pre-empt blockers before they arise
3. BUILD URGENCY — Tie to a real business event or timeline
4. PROPOSE NEXT STEP — Specific, low-friction commitment ask`,
        }

        const structure = structureMap[scriptType] || 'Use a clear opening, value proposition, and call-to-action.'

        const prompt = `You are writing a reusable call script TEMPLATE for a B2B sales team. This template will be used across many leads, so include variable placeholders for personalization.

PRODUCT/COMPANY KNOWLEDGE (from knowledge base):
${knowledgeContent.slice(0, 40000)}

STANDARD COMPANY CREDIBILITY & CALL BEHAVIOR:
${ATOMICWORK_BRAND_CONTEXT}

TARGET PERSONA: ${targetPersona || 'B2B IT/Operations decision makers'}

SCRIPT STRUCTURE TO FOLLOW:
${structure}

VARIABLE PLACEHOLDERS TO USE (required):
- {{firstName}} — prospect's first name
- {{company}} — prospect's company name
- {{jobTitle}} — prospect's job title
- {{repName}} — the sales rep's name
- {{lastName}} — prospect's last name (use sparingly)

TONE & STYLE RULES:
- Conversational, NOT corporate-speak or robotic
- Never say "I'm calling to tell you about our solution" or "I wanted to reach out"
- Pain-first: always lead with the problem they experience, not the product features
- Use specific outcomes: "80% ticket deflection", "10x faster resolution", "50%+ ticket deflection"
- Include [Wait — let them respond] or [Listen before continuing] stage directions at key moments
- Objection handling: use "Feel-Felt-Found" or "Reframe-and-Proof" patterns
- If prospect declines: script must have a graceful exit — offer to send an email, thank them, close warmly
- Do NOT oversell. ONE ask per call maximum.
${scriptType === 'objection' ? '- Cover at least 5 distinct objections with full handling script' : '- Keep to 300–450 words'}

Output ONLY the script text. No titles, no commentary, no markdown headers.`

        console.log('[Script Gen] Generating with Claude Sonnet (structured prompt)...')

        const generatedScript = await generateContent(prompt, {
            model: 'sonnet',
            system: `You are a world-class B2B sales script writer specialising in ITSM and enterprise software.
You write scripts that sound completely human and natural — not like traditional sales pitches.
Your scripts lead with pain, use social proof from real customers, and end with a low-pressure soft close.
Output ONLY the script content. No preamble, no explanation, no markdown headers.`,
            maxTokens: 1800,
            temperature: 0.65,
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
