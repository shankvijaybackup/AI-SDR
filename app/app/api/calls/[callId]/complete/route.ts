import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Clean and validate transcript before saving
 * Removes noise, normalizes text, and calculates quality metrics
 */
function cleanTranscript(transcriptArray: Array<{
    speaker: string
    text: string
    timestamp?: string
    confidence?: number
}>): {
    transcript: Array<any>
    quality: number
    avgConfidence: number
} {
    if (!Array.isArray(transcriptArray)) {
        return { transcript: [], quality: 0, avgConfidence: 0 }
    }

    let totalConfidence = 0
    let confidenceCount = 0

    const cleanedTranscript = transcriptArray
        .filter(entry => {
            // Remove empty entries
            if (!entry.text || entry.text.trim().length === 0) return false
            // Remove very short noise (single characters)
            if (entry.text.trim().length < 2) return false
            return true
        })
        .map(entry => {
            // Track confidence
            if (entry.confidence) {
                totalConfidence += entry.confidence
                confidenceCount++
            }

            let cleanedText = entry.text.trim()

            // Remove repetitive filler words
            cleanedText = cleanedText.replace(/\b(um|uh|like|you know)\s+\1+\b/gi, '$1')

            // Remove multiple spaces
            cleanedText = cleanedText.replace(/\s{2,}/g, ' ')

            // Ensure proper capitalization
            cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1)

            return {
                ...entry,
                text: cleanedText
            }
        })

    const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0
    const quality = cleanedTranscript.length >= 3 ? avgConfidence : avgConfidence * 0.5

    return {
        transcript: cleanedTranscript,
        quality: Math.round(quality * 100) / 100,
        avgConfidence: Math.round(avgConfidence * 100) / 100
    }
}

/**
 * Replace variables in email template
 */
function replaceVariables(template: string, data: Record<string, string>) {
    let result = template
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g')
        result = result.replace(regex, value || '')
    }
    return result
}

/**
 * Find matching template and send email
 */
async function sendPostCallEmail(
    companyId: string,
    leadId: string,
    callId: string,
    analysis: any,
    lead: any,
    user: any
) {
    try {
        // Determine trigger type based on analysis
        let triggerType = 'post_call_low'
        if (analysis.scheduledDemo) triggerType = 'demo_reminder' // Prioritize demo
        else if (analysis.interestLevel === 'high') triggerType = 'post_call_high'
        else if (analysis.interestLevel === 'medium') triggerType = 'post_call_medium'
        else if (analysis.interestLevel === 'not_interested') triggerType = 'post_call_not_interested'

        // Find active template
        const template = await prisma.emailTemplate.findFirst({
            where: {
                companyId,
                triggerType,
                isActive: true
            },
            orderBy: { createdAt: 'desc' } // Get most recent
        })

        if (!template) {
            console.log(`[Email Auto-Send] No template found for trigger: ${triggerType}`)
            return false
        }

        // Prepare variables
        const variables = {
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email || '',
            company: lead.company || '',
            notes: analysis.aiSummary || '',
            nextSteps: analysis.nextSteps || '',
            myFirstName: user.firstName,
            myLastName: user.lastName,
            myEmail: user.email
        }

        // Replace variables
        const subject = replaceVariables(template.subject, variables)
        const body = replaceVariables(template.body, variables)

        // Send email
        const { sendEmail } = await import('@/lib/email')
        if (lead.email) {
            const result = await sendEmail({
                to: lead.email,
                subject,
                html: body
            })

            // Log email
            await prisma.emailLog.create({
                data: {
                    companyId,
                    leadId,
                    callId,
                    templateId: template.id,
                    subject,
                    body,
                    status: result.success ? 'sent' : 'failed',
                    errorMessage: result.error,
                    sentAt: result.success ? new Date() : null
                }
            })

            console.log(`[Email Auto-Send] Email sent to ${lead.email} using template ${template.name}`)
            return true
        }

        return false

    } catch (error) {
        console.error('[Email Auto-Send] Error:', error)
        return false
    }
}

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

        console.log(`[Call Complete API] Processing call ${callId} - raw transcript entries: ${transcript?.length || 0}`)

        // Clean and validate transcript before saving
        const { transcript: cleanedTranscript, quality, avgConfidence } = cleanTranscript(transcript)

        console.log(`[Call Complete API] Cleaned transcript: ${cleanedTranscript.length} entries, quality: ${quality}, avg confidence: ${avgConfidence}`)

        // Find the call
        const existingCall = await prisma.call.findUnique({
            where: { id: callId },
            include: { lead: true }
        })

        if (!existingCall) {
            console.error(`[Call Complete API] Call ${callId} not found`)
            return NextResponse.json({ error: 'Call not found' }, { status: 404 })
        }

        // Update the call with cleaned transcript and summary
        const updatedCall = await prisma.call.update({
            where: { id: callId },
            data: {
                transcript: cleanedTranscript,
                aiSummary: summary || null,
                duration: duration || 0,
                status: status || 'completed',
                disconnectReason: disconnectReason || null
            }
        })

        console.log(`[Call Complete API] ✅ Call ${callId} updated with ${cleanedTranscript.length} cleaned transcript entries`)

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

                    // Attempt to send auto-follow-up email
                    if (existingCall.companyId && existingCall.lead.email) {
                        // Fetch user to get sender details
                        const user = await prisma.user.findUnique({ where: { id: existingCall.userId } });
                        if (user) {
                            await sendPostCallEmail(
                                existingCall.companyId,
                                existingCall.lead.id,
                                existingCall.id,
                                analysis,
                                existingCall.lead,
                                user
                            )
                        }
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
            transcriptEntries: cleanedTranscript.length,
            transcriptQuality: quality,
            avgConfidence,
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
