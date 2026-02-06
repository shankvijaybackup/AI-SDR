import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { emailCaptured, nextSteps, scheduledDemo } = body

    const call = await prisma.call.findFirst({
      where: {
        id: callId,
        userId: currentUser.userId,
      },
    })

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const updatedCall = await prisma.call.update({
      where: { id: call.id },
      data: {
        emailCaptured: emailCaptured || call.emailCaptured,
        nextSteps: nextSteps || call.nextSteps,
        scheduledDemo: scheduledDemo ? new Date(scheduledDemo) : call.scheduledDemo,
      },
    })

    return NextResponse.json({ call: updatedCall })
  } catch (error) {
    console.error('Update call error:', error)
    return NextResponse.json(
      { error: 'Failed to update call' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const call = await prisma.call.findFirst({
      where: {
        id: callId,
        userId: currentUser.userId,
      },
      include: {
        lead: true,
        script: true,
      },
    })

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    return NextResponse.json({ call })
  } catch (error) {
    console.error('Get call error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call' },
      { status: 500 }
    )
  }
}
