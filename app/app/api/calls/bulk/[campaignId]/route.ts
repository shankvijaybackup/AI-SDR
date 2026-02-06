import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { z } from 'zod'

// GET /api/calls/bulk/[campaignId] - Get campaign status and all call results
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ campaignId: string }> }
) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const { campaignId } = await params

        const campaign = await prisma.bulkCallCampaign.findFirst({
            where: {
                id: campaignId,
                userId: currentUser.userId,
            },
            include: {
                script: { select: { id: true, name: true } },
                calls: {
                    include: {
                        lead: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                company: true,
                                phone: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        })

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Get lead info for leads not yet called
        const calledLeadIds = campaign.calls.map(c => c.leadId)
        const pendingLeadIds = campaign.leadIds.filter(id => !calledLeadIds.includes(id))

        const pendingLeads = await prisma.lead.findMany({
            where: { id: { in: pendingLeadIds } },
            select: { id: true, firstName: true, lastName: true, company: true, phone: true },
        })

        return NextResponse.json({
            campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                totalLeads: campaign.totalLeads,
                completedCalls: campaign.completedCalls,
                successfulCalls: campaign.successfulCalls,
                failedCalls: campaign.failedCalls,
                currentLeadIndex: campaign.currentLeadIndex,
                delayBetweenCalls: campaign.delayBetweenCalls,
                script: campaign.script,
                createdAt: campaign.createdAt,
                completedAt: campaign.completedAt,
            },
            calls: campaign.calls.map(call => ({
                id: call.id,
                status: call.status,
                duration: call.duration,
                transcript: call.transcript,
                aiSummary: call.aiSummary,
                interestLevel: call.interestLevel,
                outcome: call.outcome,
                createdAt: call.createdAt,
                lead: call.lead,
            })),
            pendingLeads,
        })
    } catch (error) {
        console.error('Get campaign error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

const updateCampaignSchema = z.object({
    action: z.enum(['pause', 'resume', 'cancel']),
})

// PATCH /api/calls/bulk/[campaignId] - Pause/resume/cancel campaign
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ campaignId: string }> }
) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const { campaignId } = await params
        const body = await request.json()
        const { action } = updateCampaignSchema.parse(body)

        const campaign = await prisma.bulkCallCampaign.findFirst({
            where: {
                id: campaignId,
                userId: currentUser.userId,
            },
        })

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        let newStatus: string
        let completedAt: Date | null = null

        switch (action) {
            case 'pause':
                if (campaign.status !== 'running') {
                    return NextResponse.json(
                        { error: 'Can only pause running campaigns' },
                        { status: 400 }
                    )
                }
                newStatus = 'paused'
                break
            case 'resume':
                if (campaign.status !== 'paused') {
                    return NextResponse.json(
                        { error: 'Can only resume paused campaigns' },
                        { status: 400 }
                    )
                }
                newStatus = 'running'
                break
            case 'cancel':
                if (!['running', 'paused', 'pending'].includes(campaign.status)) {
                    return NextResponse.json(
                        { error: 'Cannot cancel completed or already cancelled campaigns' },
                        { status: 400 }
                    )
                }
                newStatus = 'cancelled'
                completedAt = new Date()
                break
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        // Update campaign status
        const updatedCampaign = await prisma.bulkCallCampaign.update({
            where: { id: campaignId },
            data: {
                status: newStatus,
                ...(completedAt && { completedAt }),
            },
        })

        // Notify backend about status change
        const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:4000'
        try {
            await fetch(`${backendUrl}/api/bulk-calls/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaignId,
                    action,
                }),
            })
        } catch (backendError) {
            console.error('Failed to notify backend:', backendError)
        }

        return NextResponse.json({
            campaignId: updatedCampaign.id,
            status: updatedCampaign.status,
            message: `Campaign ${action}d successfully`,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.issues },
                { status: 400 }
            )
        }

        console.error('Update campaign error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE /api/calls/bulk/[campaignId] - Delete a campaign
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ campaignId: string }> }
) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const { campaignId } = await params

        const campaign = await prisma.bulkCallCampaign.findFirst({
            where: {
                id: campaignId,
                userId: currentUser.userId,
            },
        })

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
        }

        // Disconnect any calls linked to this campaign (set campaignId to null)
        await prisma.call.updateMany({
            where: { campaignId: campaignId },
            data: { campaignId: null },
        })

        // Delete the campaign
        await prisma.bulkCallCampaign.delete({
            where: { id: campaignId },
        })

        return NextResponse.json({ success: true, message: 'Campaign deleted successfully' })
    } catch (error) {
        console.error('Delete campaign error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
