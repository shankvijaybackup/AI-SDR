import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { z } from 'zod'

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  scriptId: z.string().min(1, 'Script is required'),
  leadIds: z.array(z.string()).min(1, 'At least one lead is required'),
  delayBetweenCalls: z.number().min(0).max(60).optional().default(5),
})

// POST /api/calls/bulk - Create and start a bulk calling campaign
export async function POST(request: NextRequest) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createCampaignSchema.parse(body)

    // Verify script exists and user has access
    const script = await prisma.script.findFirst({
      where: {
        id: validatedData.scriptId,
        OR: [
          { userId: currentUser.userId },
          { isShared: true },
          { userId: null },
        ],
      },
    })

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 })
    }

    // Verify all leads exist and belong to user
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: validatedData.leadIds },
        userId: currentUser.userId,
      },
      select: { id: true, phone: true, firstName: true, lastName: true },
    })

    if (leads.length !== validatedData.leadIds.length) {
      return NextResponse.json(
        { error: 'Some leads not found or not accessible' },
        { status: 400 }
      )
    }

    // Filter out leads without phone numbers
    const callableLeads = leads.filter(lead => lead.phone && lead.phone.length > 0)
    if (callableLeads.length === 0) {
      return NextResponse.json(
        { error: 'No leads with valid phone numbers' },
        { status: 400 }
      )
    }

    // Create the bulk call campaign
    const campaign = await prisma.bulkCallCampaign.create({
      data: {
        userId: currentUser.userId,
        name: validatedData.name,
        scriptId: validatedData.scriptId,
        status: 'pending',
        totalLeads: callableLeads.length,
        leadIds: callableLeads.map(l => l.id),
        delayBetweenCalls: validatedData.delayBetweenCalls,
      },
    })

    // Start the campaign by triggering the backend
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:4000'
    
    try {
      const startResponse = await fetch(`${backendUrl}/api/bulk-calls/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          userId: currentUser.userId,
        }),
      })

      if (startResponse.ok) {
        // Update campaign status to running
        await prisma.bulkCallCampaign.update({
          where: { id: campaign.id },
          data: { status: 'running' },
        })
      }
    } catch (backendError) {
      console.error('Failed to start campaign on backend:', backendError)
      // Campaign created but not started - user can retry
    }

    return NextResponse.json({
      campaignId: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totalLeads: campaign.totalLeads,
      message: 'Campaign created and starting',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create bulk campaign error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/calls/bulk - List all campaigns for current user
export async function GET(request: NextRequest) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const campaigns = await prisma.bulkCallCampaign.findMany({
      where: { userId: currentUser.userId },
      include: {
        script: { select: { name: true } },
        _count: { select: { calls: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error('List campaigns error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
