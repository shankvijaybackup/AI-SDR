import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/calls/[callId]/complete
// Called automatically by backend when call ends to save transcript and summary
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ callId: string }> }
) {
    try {
        const { callId } = await params

        if (!callId) {
            return NextResponse.json({ error: 'Call ID is required' }, { status: 400 })
        }

        const body = await request.json()
        const { transcript, summary, duration, status, voicePersona, disconnectReason } = body

        console.log(`[Call Complete API] Saving call ${callId} - transcript entries: ${transcript?.length || 0}`)

        // Find the call
        const existingCall = await prisma.call.findUnique({
            where: { id: callId },
            include: { lead: true }
        })

        if (!existingCall) {
            console.error(`[Call Complete API] Call ${callId} not found`)
            return NextResponse.json({ error: 'Call not found' }, { status: 404 })
        }

        // Update the call with transcript and summary
        const updatedCall = await prisma.call.update({
            where: { id: callId },
            data: {
                transcript: transcript || [],
                aiSummary: summary || null,
                duration: duration || 0,
                status: status || 'completed',
                disconnectReason: disconnectReason || null
            }
        })

        console.log(`[Call Complete API] ✅ Call ${callId} updated with ${transcript?.length || 0} transcript entries`)

        // Auto-trigger analysis if we have a transcript
        if (transcript && transcript.length > 2 && existingCall.lead) {
            try {
                // Import the analysis function
                const { analyzeCall } = await import('@/lib/call-analysis')

                // analyzeCall takes (transcript, leadName, company)
                const leadName = `${existingCall.lead.firstName || ''} ${existingCall.lead.lastName || ''}`.trim()
                const company = existingCall.lead.company || 'Unknown Company'

                const analysis = await analyzeCall(transcript, leadName, company)

                if (analysis) {
                    // Update call with full analysis including follow-up fields
                    await prisma.call.update({
                        where: { id: callId },
                        data: {
                            aiSummary: analysis.aiSummary,
                            interestLevel: analysis.interestLevel || 'unknown',
                            nextSteps: analysis.nextSteps,
                            scheduledDemo: analysis.scheduledDemo,
                            objections: analysis.objections || [],
                            emailCaptured: analysis.emailCaptured,
                        }
                    })

                    // Determine lead status and follow-up based on call outcome
                    const leadUpdateData: {
                        status?: string
                        interestLevel?: string
                        notes?: string
                        nextFollowUp?: Date | null
                    } = {}

                    if (analysis.interestLevel) {
                        leadUpdateData.interestLevel = analysis.interestLevel

                        if (analysis.interestLevel === 'high') {
                            leadUpdateData.status = 'qualified'
                        } else if (analysis.interestLevel === 'medium') {
                            leadUpdateData.status = 'contacted'
                            // Set callback for medium interest if no demo scheduled
                            if (!analysis.scheduledDemo) {
                                // Follow up in 3 days for medium interest
                                leadUpdateData.nextFollowUp = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                            }
                        } else if (analysis.interestLevel === 'low') {
                            leadUpdateData.status = 'contacted'
                            // Follow up in 7 days for low interest
                            if (!analysis.scheduledDemo) {
                                leadUpdateData.nextFollowUp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                            }
                        } else {
                            leadUpdateData.status = 'not_interested'
                        }

                        leadUpdateData.notes = analysis.aiSummary || ''
                    }

                    await prisma.lead.update({
                        where: { id: existingCall.lead.id },
                        data: leadUpdateData
                    })

                    console.log(`[Call Complete API] ✅ AI analysis generated for call ${callId}`)
                    if (analysis.scheduledDemo) {
                        console.log(`[Call Complete API] 📅 Demo scheduled: ${analysis.scheduledDemo}`)
                    }
                    if (analysis.nextSteps) {
                        console.log(`[Call Complete API] 📋 Next steps: ${analysis.nextSteps}`)
                    }
                }
            } catch (analysisErr) {
                console.error(`[Call Complete API] AI analysis failed:`, analysisErr)
                // Don't fail the whole request if analysis fails
            }
        }

        return NextResponse.json({
            success: true,
            callId,
            transcriptEntries: transcript?.length || 0,
            hasSummary: !!summary
        })

    } catch (error) {
        console.error('[Call Complete API] Error:', error)
        return NextResponse.json(
            { error: 'Failed to save call data', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
