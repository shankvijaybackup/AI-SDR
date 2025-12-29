import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Determine date range (default last 30 days)
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 30)

        // Fetch valid calls with timestamps
        const calls = await prisma.call.findMany({
            where: {
                companyId: user.companyId,
                createdAt: { gte: startDate },
                status: 'completed'
            },
            select: {
                createdAt: true,
                duration: true,
                interestLevel: true
            }
        })

        // Initialize heatmap grid (7 days x 24 hours)
        // day 0 = Sunday, hour 0 = midnight
        const heatmap = Array.from({ length: 7 }, (_, day) =>
            Array.from({ length: 24 }, (_, hour) => ({
                day,
                hour,
                calls: 0,
                pickups: 0, // Duration > 10s implies pickup/connection
                successes: 0,
                pickupRate: 0
            }))
        )

        calls.forEach(call => {
            const date = new Date(call.createdAt)
            const day = date.getDay()
            const hour = date.getHours()

            const cell = heatmap[day][hour]
            cell.calls++

            // Assume pickup if duration > 10s (filtering out immediate hangups/voicemail drops)
            if ((call.duration || 0) > 10) {
                cell.pickups++
            }

            if (call.interestLevel === 'high' || call.interestLevel === 'medium') {
                cell.successes++
            }
        })

        // Flatten and calculate rates
        const flatData = heatmap.flat().map(cell => ({
            ...cell,
            pickupRate: cell.calls > 0 ? Math.round((cell.pickups / cell.calls) * 100) : 0,
            value: cell.calls > 0 ? Math.round((cell.pickups / cell.calls) * 100) : 0 // Value for heatmap color
        })).filter(cell => cell.calls > 0) // Only return slots with activity

        return NextResponse.json(flatData)

    } catch (error) {
        console.error('[Analytics Heatmap] Error:', error)
        return NextResponse.json({ error: 'Failed to fetch heatmap data' }, { status: 500 })
    }
}
