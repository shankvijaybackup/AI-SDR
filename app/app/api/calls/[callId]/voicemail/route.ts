import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/calls/[callId]/voicemail
// Returns the voicemail drop URL if configured, and updates the call record
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ callId: string }> }
) {
    try {
        const { callId } = await params
        console.log(`[Voicemail API] Processing voicemail drop for call ${callId}`)

        const call = await prisma.call.findUnique({
            where: { id: callId },
            include: { company: { include: { voicemailMessages: true } } }
        })

        if (!call) {
            return NextResponse.json({ error: 'Call not found' }, { status: 404 })
        }

        // Update AMD result
        await prisma.call.update({
            where: { id: callId },
            data: { amdResult: 'machine' }
        })

        // Find default or active voicemail message
        const vmMessage = call.company?.voicemailMessages.find(m => m.isActive && m.isDefault) ||
            call.company?.voicemailMessages.find(m => m.isActive)

        if (!vmMessage || !vmMessage.audioUrl) {
            console.log(`[Voicemail API] No active voicemail message found for company ${call.companyId}`)
            return NextResponse.json({ dropped: false })
        }

        // Update call to mark voicemail dropped
        await prisma.call.update({
            where: { id: callId },
            data: {
                voicemailDropped: true,
                status: 'completed',
                disconnectReason: 'Voicemail dropped',
                outcome: 'voicemail_left'
            }
        })

        console.log(`[Voicemail API] Returning audio URL: ${vmMessage.audioUrl}`)
        return NextResponse.json({
            dropped: true,
            audioUrl: vmMessage.audioUrl
        })

    } catch (error) {
        console.error('[Voicemail API] Error:', error)
        return NextResponse.json({ error: 'Failed to process voicemail' }, { status: 500 })
    }
}
