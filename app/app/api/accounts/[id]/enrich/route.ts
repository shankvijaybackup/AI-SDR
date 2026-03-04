
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'

// ─── Tavily quick search helper ─────────────────────────────────────────────
async function tavilySearch(query: string): Promise<string> {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) return ''
    try {
        const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                search_depth: 'basic',
                include_answer: true,
                max_results: 5,
            }),
        })
        if (!res.ok) return ''
        const data = await res.json()
        const answer = data.answer ? `Summary: ${data.answer}\n` : ''
        const snippets = (data.results || [])
            .map((r: any) => `${r.title}: ${r.content}`)
            .slice(0, 4)
            .join('\n')
        return answer + snippets
    } catch { return '' }
}

// ─── Exa fallback ────────────────────────────────────────────────────────────
async function exaSearch(query: string): Promise<string> {
    const apiKey = process.env.EXA_API_KEY
    if (!apiKey) return ''
    try {
        const res = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
            body: JSON.stringify({
                query,
                num_results: 5,
                use_autoprompt: true,
                type: 'neural',
                contents: { text: { max_characters: 600 } },
            }),
        })
        if (!res.ok) return ''
        const data = await res.json()
        return (data.results || [])
            .map((r: any) => `${r.title}: ${r.text || r.snippet || ''}`)
            .join('\n')
    } catch { return '' }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = getCurrentUserFromRequest(req)
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params

        const account = await prisma.account.findUnique({
            where: { id }
        })

        if (!account || (account.companyId && account.companyId !== user.companyId)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const url = account.domain

        console.log(`Enriching account ${account.name} (Domain: ${url || 'N/A'})...`)

        // 1. Fetch content (if domain exists) + Tavily/Exa web search — run in parallel
        const [websiteResult, tavilyResult] = await Promise.allSettled([
            (async () => {
                if (!url) return '(No domain provided)'
                try {
                    const targetUrl = url.startsWith('http') ? url : `https://${url}`
                    const { fetchContentFromURL } = await import('@/lib/document-processor')
                    return await fetchContentFromURL(targetUrl)
                } catch {
                    return `(Website fetch failed for ${url})`
                }
            })(),
            (async () => {
                const query = `${account.name} company overview industry revenue employees location`
                let result = await tavilySearch(query)
                if (!result) result = await exaSearch(query)
                return result
            })(),
        ])

        const textContent = websiteResult.status === 'fulfilled' ? websiteResult.value : '(Website fetch failed)'
        const webIntel = tavilyResult.status === 'fulfilled' ? tavilyResult.value : ''
        if (webIntel) console.log(`[Enrich] Got ${webIntel.length} chars of live web intel for ${account.name}`)

        // 2. AI Extraction (Claude) — include web intel if available
        const { generateJSON } = await import('@/lib/claude')

        const prompt = `Analyze this company and extract structured information.

Company: ${account.name}
Domain: ${url || 'Unknown'}

Website Content Snippet:
${textContent.substring(0, 6000)}
${webIntel ? `\nLive Web Intelligence (Tavily/Exa):\n${webIntel.substring(0, 3000)}` : ''}

Instructions:
- Use ALL sources above. Prefer specific, factual data over guesses.
- If information is unavailable in sources, use your internal knowledge about "${account.name}".
- Return a VALID JSON object.

JSON Structure:
{
    "description": "Short 2 sentence summary",
    "specialties": ["Tech 1", "Tech 2"],
    "industry": "Industry Name",
    "employeeCount": 100,
    "annualRevenue": "Revenue Range",
    "location": "City, Country"
}

Rules:
- employeeCount must be a NUMBER (approximate).
- annualRevenue should be a string (e.g. "$10M-$50M").`

        let enrichmentData: any = {}
        try {
            enrichmentData = await generateJSON(prompt, { model: 'haiku', maxTokens: 1024 })
        } catch (e) {
            console.error('Failed to parse AI response:', e)
            enrichmentData = {
                description: `Could not analyze ${account.name}.`,
                specialties: []
            }
        }

        const updated = await prisma.account.update({
            where: { id },
            data: {
                enriched: true,
                industry: enrichmentData.industry || account.industry,
                employeeCount: typeof enrichmentData.employeeCount === 'number' ? enrichmentData.employeeCount : undefined,
                annualRevenue: enrichmentData.annualRevenue || account.annualRevenue,
                location: enrichmentData.location || account.location,
                enrichmentData
            }
        })

        // 3. Trigger Deep Research (Context-Aware Grounding)
        try {
            const { performDeepResearch } = await import('@/lib/account-research')
            const { performTechnographicEnrichment } = await import('@/lib/technographic-client')

            console.log('Triggering deep research and technographic enrichment...')

            await Promise.allSettled([
                performDeepResearch(id, user.userId),
                performTechnographicEnrichment(id)
            ])

        } catch (researchError) {
            console.error('Research/Enrichment failed:', researchError)
            // Do not fail the request
        }

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Error enriching account:', error)
        return NextResponse.json({ error: 'Internal Server Error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
    }
}
