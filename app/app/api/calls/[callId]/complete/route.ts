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
        const { transcript, summary, duration, status, voicePersona } = body

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
                status: status || 'completed'
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
                    // Update call with analysis - use correct field name 'analysis' not 'aiAnalysis'
                    await prisma.call.update({
                        where: { id: callId },
                        data: {
                            aiSummary: analysis.aiSummary,
                            interestLevel: analysis.interestLevel || 'unknown'
                        }
                    })

                    // Update lead with outcome from call
                    if (analysis.interestLevel) {
                        await prisma.lead.update({
                            where: { id: existingCall.lead.id },
                            data: {
                                status: analysis.interestLevel === 'high' ? 'qualified' :
                                    analysis.interestLevel === 'medium' ? 'contacted' : 'pending',
                                notes: analysis.aiSummary || ''
                            }
                        })
                    }

                    console.log(`[Call Complete API] ✅ AI analysis generated for call ${callId}`)
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
