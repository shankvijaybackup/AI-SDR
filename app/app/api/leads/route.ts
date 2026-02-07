import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, getCurrentUserFromRequest } from '@/lib/auth'
import { z } from 'zod'

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:4000'
const FRONTEND_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const createLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().min(1, 'Phone is required'),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  linkedinUrl: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
  notes: z.string().optional(),
  region: z.string().min(1, 'Region is required'),
})

export async function GET(request: NextRequest) {
  try {
    // Use request-based auth for production reliability
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      console.error('[Leads API GET] Authentication failed')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const interestLevel = searchParams.get('interestLevel')
    const search = searchParams.get('search')

    const where: any = {}

    // Multi-tenancy: filter by companyId if present, otherwise by userId
    if (currentUser.companyId) {
      where.companyId = currentUser.companyId
    } else {
      where.userId = currentUser.userId
    }

    if (status) where.status = status
    if (interestLevel) where.interestLevel = interestLevel
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        calls: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    return NextResponse.json({ leads })
  } catch (error) {
    console.error('Get leads error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Use request-based auth for production reliability
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      console.error('[Leads API] Authentication failed - no valid user from request')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('[Leads API] Authenticated user:', currentUser.email, 'Role:', currentUser.role)

    const body = await request.json()
    const validatedData = createLeadSchema.parse(body)

    const lead = await prisma.lead.create({
      data: {
        ...validatedData,
        userId: currentUser.userId,
        companyId: currentUser.companyId,  // Multi-tenancy
        email: validatedData.email || null,
        linkedinUrl: validatedData.linkedinUrl || null,
      },
    })

    // Trigger automatic enrichment pipeline in background
    // This includes: account mapping, LinkedIn enrichment, script generation, and deep research
    if (lead.linkedinUrl || lead.company) {
      console.log(`[Auto-Enrich] Triggering background enrichment for lead ${lead.id}`)

      // Get auth token to pass through the request chain
      const authToken = request.cookies.get('auth-token')?.value

      if (authToken) {
        // Call frontend enrich route which will:
        // 1. Auto-create/link account if company exists
        // 2. Proxy to backend with proper auth for LinkedIn enrichment
        fetch(`${FRONTEND_URL}/api/leads/${lead.id}/enrich`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'Cookie': `auth-token=${authToken}`,
          },
        }).catch(err => {
          console.error(`[Auto-Enrich] Background enrichment failed for lead ${lead.id}:`, err)
        })

        // Call frontend script generation route
        fetch(`${FRONTEND_URL}/api/leads/${lead.id}/script/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            'Cookie': `auth-token=${authToken}`,
          },
        }).catch(err => {
          console.error(`[Auto-Enrich] Script generation failed for lead ${lead.id}:`, err)
        })

        console.log(`[Auto-Enrich] Background jobs triggered for lead ${lead.id}`)
      } else {
        console.warn(`[Auto-Enrich] No auth token available - skipping automatic enrichment`)
      }
    } else {
      console.log(`[Auto-Enrich] Lead ${lead.id} has no LinkedIn URL or company - skipping enrichment`)
    }

    return NextResponse.json({
      lead,
      message: lead.linkedinUrl || lead.company
        ? 'Lead created successfully. Enrichment and script generation in progress (may take a few minutes).'
        : 'Lead created successfully.'
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create lead error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
