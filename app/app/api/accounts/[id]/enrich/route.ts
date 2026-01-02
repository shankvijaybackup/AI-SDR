
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
        const { GoogleGenerativeAI } = await import('@google/generative-ai')
        const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || ''
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const prompt = `Analyze this company data (website content or name) and extract structured information.
        
        Input Data:
        ${textContent.slice(0, 50000)}

        Return a JSON object with these fields:
        {
            "description": "Short 1-2 sentence description of what they do",
            "industry": "Specific industry (e.g. B2B SaaS, FinTech)",
            "specialties": ["List", "of", "3-5", "keywords"],
            "employees": "Approximate range (e.g. 50-200, 1000+)",
            "headquarters": "City, Country (if found)",
            "revenue": "Approximate revenue (if found, else 'Private')"
        }
        
        CRITICAL: Return ONLY valid JSON.`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()

        let enrichmentData: any = {}
        try {
            const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
            enrichmentData = JSON.parse(cleanedJson)
        } catch (e) {
            console.error('Failed to parse AI response:', responseText)
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
