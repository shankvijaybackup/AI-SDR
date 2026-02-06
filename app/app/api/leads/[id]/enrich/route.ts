import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:4000'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id: leadId } = await params

    // Call backend enrichment API (has multi-model synthesis)
    console.log(`[Frontend Enrich] Proxying to backend: ${BACKEND_URL}/api/leads/${leadId}/enrich`)
    const response = await fetch(`${BACKEND_URL}/api/leads/${leadId}/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Enrichment failed' }))
      return NextResponse.json(
        { error: error.error || error.message || 'Failed to enrich lead' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Enrich lead error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
