import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const body = await request.json()
        const { url, companyName, existingKnowledge } = body

        if (!url || !companyName) {
            return NextResponse.json({ error: 'Missing url or companyName' }, { status: 400 })
        }

        // Proxy to backend service
        const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:4000';
        console.log(`[Proxy] Forwarding persona generation to ${backendUrl}/api/knowledge/persona`);
        if (existingKnowledge) {
            console.log(`[Proxy] Including ${existingKnowledge.length} chars of existing knowledge`);
        }

        const response = await fetch(`${backendUrl}/api/knowledge/persona`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, companyName, existingKnowledge }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            try {
                const errorJson = JSON.parse(errorText)
                return NextResponse.json(errorJson, { status: response.status })
            } catch {
                return NextResponse.json(
                    { error: `Backend error: ${response.statusText}` },
                    { status: response.status }
                )
            }
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Persona generation proxy error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
