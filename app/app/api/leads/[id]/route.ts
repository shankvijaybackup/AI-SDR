import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const updateLeadSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  region: z.string().optional(),
  status: z.enum(['pending', 'scheduled', 'completed', 'not_interested']).optional(),
  interestLevel: z.enum(['high', 'medium', 'low', 'none']).optional(),
  nextFollowUp: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: id,
        userId: currentUser.userId,
      },
      include: {
        calls: {
          orderBy: { createdAt: 'desc' },
        },
        account: {
          include: {
            researchNotes: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    return NextResponse.json({ lead })
  } catch (error) {
    console.error('Get lead error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateLeadSchema.parse(body)

    const lead = await prisma.lead.findFirst({
      where: {
        id: id,
        userId: currentUser.userId,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const updatedLead = await prisma.lead.update({
      where: { id: id },
      data: {
        ...validatedData,
        email: validatedData.email || null,
        linkedinUrl: validatedData.linkedinUrl || null,
        nextFollowUp: validatedData.nextFollowUp ? new Date(validatedData.nextFollowUp) : undefined,
      },
    })

    return NextResponse.json({ lead: updatedLead })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Update lead error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: id,
        userId: currentUser.userId,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    await prisma.lead.delete({
      where: { id: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete lead error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
