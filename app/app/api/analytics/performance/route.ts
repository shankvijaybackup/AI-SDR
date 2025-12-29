import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Aggregate stats by agent (user)
        const agentStats = await prisma.call.groupBy({
            by: ['userId'],
            where: {
                companyId: user.companyId,
                status: 'completed'
            },
            _count: {
                id: true // Total calls
            },
            _avg: {
                duration: true // Avg duration
            }
        })

        // Enhance with user details and success metrics
        const leaderboard = await Promise.all(agentStats.map(async (stat) => {
            const agent = await prisma.user.findUnique({
                where: { id: stat.userId },
                select: { firstName: true, lastName: true }
            })

            // Count successful outcomes (demos or high interest)
            const successes = await prisma.call.count({
                where: {
                    userId: stat.userId,
                    OR: [
                        { scheduledDemo: { not: null } },
                        { interestLevel: 'high' }
                    ]
                }
            })

            return {
                agentId: stat.userId,
                name: agent ? `${agent.firstName} ${agent.lastName}` : 'Unknown Agent',
                totalCalls: stat._count.id,
                avgDuration: Math.round(stat._avg.duration || 0),
                successes,
                successRate: stat._count.id > 0 ? Math.round((successes / stat._count.id) * 100) : 0
            }
        }))

        // Sort by success rate desc
        leaderboard.sort((a, b) => b.successRate - a.successRate)

        return NextResponse.json(leaderboard)
    } catch (error) {
        console.error('[Analytics Performance] Error:', error)
        return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 })
    }
}
