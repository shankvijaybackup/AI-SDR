import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const completeSchema = z.object({
    followUpId: z.string(),
    action: z.enum(['complete', 'snooze']),
    snoozeUntil: z.string().optional(), // ISO date string for snooze
})

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { followUpId, action, snoozeUntil } = completeSchema.parse(body)

        // Parse the followUpId to determine type and actual ID
        // Format: "demo-{callId}" | "callback-{leadId}" | "action-{callId}"
        const [type, id] = followUpId.split('-')

        if (!type || !id) {
            return NextResponse.json({ error: 'Invalid follow-up ID' }, { status: 400 })
        }

        if (action === 'complete') {
            // Mark the follow-up as complete by clearing the relevant field
            if (type === 'demo' || type === 'action') {
                // Clear scheduledDemo or mark as handled
                await prisma.call.update({
                    where: {
                        id,
                        companyId: user.companyId,
                    },
                    data: {
                        scheduledDemo: null,
                        nextSteps: type === 'action' ? null : undefined,
                    },
                })
            } else if (type === 'callback') {
                // Clear lead's nextFollowUp
                await prisma.lead.update({
                    where: {
                        id,
                        companyId: user.companyId,
                    },
                    data: { nextFollowUp: null },
                })
            }

            return NextResponse.json({ success: true, message: 'Follow-up marked complete' })
        } else if (action === 'snooze') {
            const newDate = snoozeUntil ? new Date(snoozeUntil) : new Date(Date.now() + 24 * 60 * 60 * 1000) // Default: tomorrow

            if (type === 'demo') {
                await prisma.call.update({
                    where: {
                        id,
                        companyId: user.companyId,
                    },
                    data: { scheduledDemo: newDate },
                })
            } else if (type === 'callback') {
                await prisma.lead.update({
                    where: {
                        id,
                        companyId: user.companyId,
                    },
                    data: { nextFollowUp: newDate },
                })
            } else if (type === 'action') {
                // For action items, convert to a lead callback
                const call = await prisma.call.findUnique({
                    where: { id },
                    select: { leadId: true },
                })
                if (call) {
                    await prisma.lead.update({
                        where: { id: call.leadId },
                        data: { nextFollowUp: newDate },
                    })
                    // Clear the nextSteps since we've created a proper follow-up
                    await prisma.call.update({
                        where: { id },
                        data: { nextSteps: null },
                    })
                }
            }

            return NextResponse.json({ success: true, message: 'Follow-up snoozed', newDate })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors }, { status: 400 })
        }
        console.error('Failed to update follow-up:', error)
        return NextResponse.json({ error: 'Failed to update follow-up' }, { status: 500 })
    }
}
