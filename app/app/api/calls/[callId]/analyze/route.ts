import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { analyzeCall } from '@/lib/call-analysis'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { callId } = await params

    const call = await prisma.call.findFirst({
      where: {
        id: callId,
        userId: currentUser.userId,
      },
      include: {
        lead: true,
      },
    })

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Analyze the call transcript
    const transcript = call.transcript as any[]
    const analysis = await analyzeCall(
      transcript,
      `${call.lead.firstName} ${call.lead.lastName}`,
      call.lead.company || 'Unknown Company'
    )

    // Update call with analysis
    const updatedCall = await prisma.call.update({
      where: { id: call.id },
      data: {
        aiSummary: analysis.aiSummary,
        interestLevel: analysis.interestLevel,
        objections: analysis.objections,
        emailCaptured: analysis.emailCaptured,
        nextSteps: analysis.nextSteps,
        scheduledDemo: analysis.scheduledDemo,
      },
    })

    // Update lead interest level if higher
    if (analysis.interestLevel === 'high' || analysis.interestLevel === 'medium') {
      await prisma.lead.update({
        where: { id: call.leadId },
        data: {
          interestLevel: analysis.interestLevel,
          status: analysis.interestLevel === 'high' ? 'scheduled' : 'contacted',
        },
      })
    }

    return NextResponse.json({
      success: true,
      analysis: {
        aiSummary: updatedCall.aiSummary,
        interestLevel: updatedCall.interestLevel,
        objections: updatedCall.objections,
        emailCaptured: updatedCall.emailCaptured,
        nextSteps: updatedCall.nextSteps,
        scheduledDemo: updatedCall.scheduledDemo,
      },
    })
  } catch (error) {
    console.error('Call analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze call' },
      { status: 500 }
    )
  }
}
