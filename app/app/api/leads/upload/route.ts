import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { leads } = body

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'Invalid leads data' },
        { status: 400 }
      )
    }

    const createdLeads = await prisma.lead.createMany({
      data: leads.map((lead: any) => ({
        userId: currentUser.userId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email || null,
        phone: lead.phone,
        company: lead.company || null,
        jobTitle: lead.jobTitle || null,
        linkedinUrl: lead.linkedinUrl || null,
        notes: lead.notes || null,
        region: lead.region ? String(lead.region).trim() || null : null,
      })),
      skipDuplicates: true,
    })

    return NextResponse.json({
      success: true,
      count: createdLeads.count,
    })
  } catch (error) {
    console.error('Upload leads error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
