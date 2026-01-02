
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params

        const account = await prisma.account.findUnique({
            where: { id }
        })

        if (!account || (account.companyId && account.companyId !== user.companyId)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const url = account.domain
        if (!url) {
            return NextResponse.json({ error: 'Account has no domain to enrich from.' }, { status: 400 })
        }

        console.log(`Enriching account ${account.name} from ${url}...`)

        // 1. Fetch content
        let textContent = ''
        try {
            // Helper to ensure protocol
            const targetUrl = url.startsWith('http') ? url : `https://${url}`
            const { fetchContentFromURL } = await import('@/lib/document-processor')
            textContent = await fetchContentFromURL(targetUrl)
        } catch (fetchError) {
            console.error('Failed to fetch website content:', fetchError)
            // Fallback to simple name-based hallucination/knowledge if fetch fails? 
            // No, better to return error or partial data. Let's use simple prompt on name if fetch fails.
            textContent = `Company Name: ${account.name}. Domain: ${url}. (Website verify failed, infer from name/domain)`
        }

        // 2. AI Extraction (Gemini)
        const { generateContentSafe } = await import('@/lib/gemini')

        const prompt = `Analyze this company data (website content or name) and extract structured information.
        
        Company: ${account.name}
        Domain: ${account.domain}
        
        Website Content Snippet (if available):
        ${textContent.substring(0, 10000)}
        
        Return a JSON object with:
        - description: Short 2 sentence summary of what they do.
        - specialties: Array of strings (key technologies or services).
        - industry: Best guess industry.
        - employeeCount: Estimated number (number only, e.g. 100).
        - annualRevenue: Estimated revenue range (string).
        - location: HQ location string.
        `

        const result = await generateContentSafe(prompt, { jsonMode: true })
        const response = await result.response
        const text = response.text()
        let enrichmentData: any = {}
        try {
            const cleanedJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
            enrichmentData = JSON.parse(cleanedJson)
        } catch (e) {
            console.error('Failed to parse AI response:', text)
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
                // Map other fields if schema supports them, otherwise store in enrichmentData JSON
                enrichmentData
            }
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Error enriching account:', error)
        return NextResponse.json({ error: 'Internal Server Error: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
    }
}
