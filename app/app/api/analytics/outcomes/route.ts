import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(req)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const timeRange = searchParams.get('range') || '30d'

        const now = new Date()
        let startDate = new Date()

        switch (timeRange) {
            case '7d':
                startDate.setDate(now.getDate() - 7)
                break
            case '30d':
                startDate.setDate(now.getDate() - 30)
                break
            case '90d':
                startDate.setDate(now.getDate() - 90)
                break
            case 'all':
                startDate = new Date(0)
                break
        }

        const calls = await prisma.call.findMany({
            where: {
                companyId: currentUser.companyId,
                createdAt: { gte: startDate },
            },
            select: {
                outcome: true,
                conversionStage: true,
            },
        })

        const totalCalls = calls.length

        // Outcome distribution
        const outcomes: Record<string, number> = {}
        calls.forEach(call => {
            const outcome = call.outcome || 'unknown'
            outcomes[outcome] = (outcomes[outcome] || 0) + 1
        })

        // Funnel stages
        const funnelStages = {
            awareness: 0,
            interest: 0,
            consideration: 0,
            decision: 0,
            closed: 0
        }

        calls.forEach(call => {
            if (call.conversionStage && call.conversionStage in funnelStages) {
                funnelStages[call.conversionStage as keyof typeof funnelStages]++
            }
        })

        return NextResponse.json({
            totalCalls,
            outcomes,
            funnelStages,
            range: timeRange
        })

    } catch (error) {
        console.error('Analytics outcomes error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch outcomes' },
            { status: 500 }
        )
    }
}
