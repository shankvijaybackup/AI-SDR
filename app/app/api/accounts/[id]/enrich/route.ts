
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

        console.log(`Enriching account ${account.name} (Domain: ${url || 'N/A'})...`)

        // 1. Fetch content (if domain exists)
        let textContent = ''
        if (url) {
            try {
                const targetUrl = url.startsWith('http') ? url : `https://${url}`
                const { fetchContentFromURL } = await import('@/lib/document-processor')
                textContent = await fetchContentFromURL(targetUrl)
            } catch (fetchError) {
                console.warn('Failed to fetch website content:', fetchError)
                textContent = `(Website fetch failed for ${url})`
            }
        } else {
            textContent = '(No domain provided)'
        }

        // 2. AI Extraction (Gemini)
        const { generateContentSafe } = await import('@/lib/gemini')

        const prompt = `Analyze this company and extract structured information.
        
        Company: ${account.name}
        Domain: ${url || 'Unknown'}
        
        Website Content Snippet:
        ${textContent.substring(0, 10000)}
        
        Instructions:
        - If website content is missing, use your internal knowledge about the company "${account.name}".
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
        - annualRevenue should be a string (e.g. "$10M-$50M").
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

            // Run in parallel
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
