import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { enrichLead } from '@/lib/linkedin-enrichment'

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const leadId = params.leadId
    const success = await enrichLead(leadId, currentUser.userId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to enrich lead. Make sure LinkedIn session is configured and lead has a LinkedIn URL.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Enrich lead error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
