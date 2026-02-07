import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:4000'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id: leadId } = await params

    // Fetch the lead to check for company
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { company: true, userId: true, companyId: true, accountId: true }
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Auto-create/link account if lead has a company but no account
    if (lead.company && !lead.accountId) {
      console.log(`[Auto-Account] Lead has company "${lead.company}" but no account. Creating/linking...`)

      // Check if account already exists for this company
      let account = await prisma.account.findFirst({
        where: {
          name: { equals: lead.company, mode: 'insensitive' },
          ...(lead.companyId ? { companyId: lead.companyId } : { userId: lead.userId })
        }
      })

      // Create account if it doesn't exist
      if (!account) {
        console.log(`[Auto-Account] Creating new account for "${lead.company}"`)
        account = await prisma.account.create({
          data: {
            name: lead.company,
            ...(lead.companyId ? { companyId: lead.companyId } : { userId: lead.userId })
          }
        })
      }

      // Link lead to account
      await prisma.lead.update({
        where: { id: leadId },
        data: { accountId: account.id }
      })

      console.log(`[Auto-Account] ✅ Linked lead to account ${account.id}`)
    }

    // Call backend enrichment API (has multi-model synthesis)
    console.log(`[Frontend Enrich] Proxying to backend: ${BACKEND_URL}/api/leads/${leadId}/enrich`)

    // Get auth token from request cookies to pass to backend
    const authToken = request.cookies.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ error: 'Authentication token missing' }, { status: 401 })
    }

    const response = await fetch(`${BACKEND_URL}/api/leads/${leadId}/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cookie': `auth-token=${authToken}`,
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
