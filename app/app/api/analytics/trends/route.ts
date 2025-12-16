import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
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
        userId: currentUser.userId,
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        outcome: true,
        interestLevel: true,
        duration: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const bucket: Record<
      string,
      { date: string; calls: number; booked: number; interested: number; avgDuration: number }
    > = {}

    for (const c of calls) {
      const date = c.createdAt.toISOString().slice(0, 10)
      if (!bucket[date]) {
        bucket[date] = { date, calls: 0, booked: 0, interested: 0, avgDuration: 0 }
      }
      bucket[date].calls += 1
      if (c.outcome === 'booked') bucket[date].booked += 1
      if (c.outcome === 'interested') bucket[date].interested += 1
      bucket[date].avgDuration += c.duration || 0
    }

    const series = Object.values(bucket)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        avgDuration: d.calls > 0 ? Math.round(d.avgDuration / d.calls) : 0,
      }))

    return NextResponse.json({
      range: timeRange,
      startDate,
      endDate: now,
      series,
    })
  } catch (error) {
    console.error('Analytics trends error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    )
  }
}
