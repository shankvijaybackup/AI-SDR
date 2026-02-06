import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const currentUser = getCurrentUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get all calls for the user
    const calls = await prisma.call.findMany({
      where: {
        userId: currentUser.userId,
      },
      include: {
        lead: {
          select: {
            firstName: true,
            lastName: true,
            company: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Get total leads
    const totalLeads = await prisma.lead.count({
      where: {
        userId: currentUser.userId,
      },
    })

    // Calculate metrics
    const totalCalls = calls.length
    const averageDuration = calls.length > 0
      ? Math.floor(calls.reduce((sum, call) => sum + (call.duration || 0), 0) / calls.length)
      : 0

    // Calls today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const callsToday = calls.filter(call => new Date(call.createdAt) >= today).length

    // Interest breakdown
    const interestBreakdown = {
      high: calls.filter(c => c.interestLevel === 'high').length,
      medium: calls.filter(c => c.interestLevel === 'medium').length,
      low: calls.filter(c => c.interestLevel === 'low').length,
      not_interested: calls.filter(c => c.interestLevel === 'not_interested').length,
    }

    // Demos scheduled
    const demosScheduled = calls.filter(c => c.scheduledDemo !== null).length

    // Emails captured
    const emailsCaptured = calls.filter(c => c.emailCaptured !== null).length

    // Top objections
    const objectionsMap = new Map<string, number>()
    calls.forEach(call => {
      if (Array.isArray(call.objections)) {
        call.objections.forEach((obj: string) => {
          objectionsMap.set(obj, (objectionsMap.get(obj) || 0) + 1)
        })
      }
    })
    const topObjections = Array.from(objectionsMap.entries())
      .map(([objection, count]) => ({ objection, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Recent calls
    const recentCalls = calls.slice(0, 10).map(call => ({
      id: call.id,
      leadName: `${call.lead.firstName} ${call.lead.lastName}`,
      company: call.lead.company || 'Unknown',
      interestLevel: call.interestLevel,
      status: call.status,
      createdAt: call.createdAt,
    }))

    return NextResponse.json({
      totalCalls,
      totalLeads,
      averageDuration,
      interestBreakdown,
      callsToday,
      demosScheduled,
      emailsCaptured,
      topObjections,
      recentCalls,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
