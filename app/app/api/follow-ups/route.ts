import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
        const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000)

        // Fetch calls with scheduled demos (future or overdue)
        const callsWithDemos = await prisma.call.findMany({
            where: {
                companyId: user.companyId,
                scheduledDemo: { not: null },
            },
            include: {
                lead: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        company: true,
                        phone: true,
                        email: true,
                    },
                },
            },
            orderBy: { scheduledDemo: 'asc' },
        })

        // Fetch calls with nextSteps (recent calls that may need follow-up)
        const callsWithNextSteps = await prisma.call.findMany({
            where: {
                companyId: user.companyId,
                nextSteps: { not: null },
                status: 'completed',
                // Only calls from the last 30 days
                createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            },
            include: {
                lead: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        company: true,
                        phone: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })

        // Fetch leads with nextFollowUp set
        const leadsWithFollowUp = await prisma.lead.findMany({
            where: {
                companyId: user.companyId,
                nextFollowUp: { not: null },
            },
            orderBy: { nextFollowUp: 'asc' },
        })

        // Build unified follow-up list
        interface FollowUp {
            id: string
            type: 'demo' | 'callback' | 'action'
            priority: 'high' | 'medium' | 'low'
            dueDate: Date
            isOverdue: boolean
            lead: {
                id: string
                firstName: string
                lastName: string
                company: string | null
                phone: string
                email: string | null
            }
            call: {
                id: string
                aiSummary: string | null
                outcome: string | null
                nextSteps: string | null
            } | null
            description: string
        }

        const followUps: FollowUp[] = []

        // Add scheduled demos
        for (const call of callsWithDemos) {
            if (call.scheduledDemo) {
                const dueDate = new Date(call.scheduledDemo)
                const isOverdue = dueDate < now
                followUps.push({
                    id: `demo-${call.id}`,
                    type: 'demo',
                    priority: isOverdue ? 'high' : (dueDate < endOfToday ? 'high' : 'medium'),
                    dueDate,
                    isOverdue,
                    lead: call.lead,
                    call: {
                        id: call.id,
                        aiSummary: call.aiSummary,
                        outcome: call.outcome,
                        nextSteps: call.nextSteps,
                    },
                    description: 'Scheduled demo',
                })
            }
        }

        // Add lead callbacks
        for (const lead of leadsWithFollowUp) {
            if (lead.nextFollowUp) {
                const dueDate = new Date(lead.nextFollowUp)
                const isOverdue = dueDate < now
                followUps.push({
                    id: `callback-${lead.id}`,
                    type: 'callback',
                    priority: isOverdue ? 'high' : (dueDate < endOfToday ? 'medium' : 'low'),
                    dueDate,
                    isOverdue,
                    lead: {
                        id: lead.id,
                        firstName: lead.firstName,
                        lastName: lead.lastName,
                        company: lead.company,
                        phone: lead.phone,
                        email: lead.email,
                    },
                    call: null,
                    description: 'Scheduled callback',
                })
            }
        }

        // Add action items from calls (nextSteps)
        for (const call of callsWithNextSteps) {
            // Skip if already have a demo entry for this call
            if (followUps.some(f => f.call?.id === call.id)) continue

            followUps.push({
                id: `action-${call.id}`,
                type: 'action',
                priority: 'low',
                dueDate: new Date(call.createdAt),
                isOverdue: false,
                lead: call.lead,
                call: {
                    id: call.id,
                    aiSummary: call.aiSummary,
                    outcome: call.outcome,
                    nextSteps: call.nextSteps,
                },
                description: call.nextSteps || 'Follow up required',
            })
        }

        // Sort by priority then date
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        followUps.sort((a, b) => {
            if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority]
            }
            return a.dueDate.getTime() - b.dueDate.getTime()
        })

        // Calculate stats
        const stats = {
            total: followUps.length,
            overdue: followUps.filter(f => f.isOverdue).length,
            today: followUps.filter(f => f.dueDate >= startOfToday && f.dueDate < endOfToday).length,
            thisWeek: followUps.filter(f => f.dueDate >= startOfToday && f.dueDate < endOfWeek).length,
        }

        return NextResponse.json({ followUps, stats })
    } catch (error) {
        console.error('Failed to fetch follow-ups:', error)
        return NextResponse.json({ error: 'Failed to fetch follow-ups' }, { status: 500 })
    }
}
