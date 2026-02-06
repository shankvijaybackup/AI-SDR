import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
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
        objections: true,
        outcome: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const counts: Record<string, { objection: string; count: number; booked: number; interested: number }> = {}

    for (const call of calls) {
      const objections = Array.isArray(call.objections) ? call.objections : []
      for (const obj of objections) {
        const key = String(obj || '').trim()
        if (!key) continue
        if (!counts[key]) {
          counts[key] = { objection: key, count: 0, booked: 0, interested: 0 }
        }
        counts[key].count += 1
        if (call.outcome === 'booked') counts[key].booked += 1
        if (call.outcome === 'interested') counts[key].interested += 1
      }
    }

    const top = Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return NextResponse.json({
      range: timeRange,
      top,
      totalCalls: calls.length,
    })
  } catch (error) {
    console.error('Analytics objections error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch objections' },
      { status: 500 }
    )
  }
}
