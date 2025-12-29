import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get counts for each stage of the funnel
        const [
            totalLeads,
            contactedLeads,
            qualifiedLeads,
            demosScheduled,
            closedWon
        ] = await Promise.all([
            // Stage 1: All Leads
            prisma.lead.count({
                where: { companyId: user.companyId }
            }),

            // Stage 2: Contacted (status changed from pending or had a call)
            prisma.lead.count({
                where: {
                    companyId: user.companyId,
                    OR: [
                        { status: 'contacted' },
                        { status: 'qualified' },
                        { status: 'closed_won' },
                        { status: 'not_interested' },
                        // Or has at least one completed call
                        { calls: { some: { status: 'completed' } } }
                    ]
                }
            }),

            // Stage 3: Qualified (High interest)
            prisma.lead.count({
                where: {
                    companyId: user.companyId,
                    OR: [
                        { status: 'qualified' },
                        { interestLevel: 'high' }
                    ]
                }
            }),

            // Stage 4: Demo Scheduled (from Call outcome)
            prisma.call.count({
                where: {
                    companyId: user.companyId,
                    scheduledDemo: { not: null }
                }
            }),

            // Stage 5: Closed Won (Ideal end state)
            prisma.lead.count({
                where: {
                    companyId: user.companyId,
                    status: 'closed_won'
                }
            })
        ])

        const funnelData = [
            { id: 'leads', name: 'Total Leads', value: totalLeads, fill: '#8884d8' },
            { id: 'contacted', name: 'Contacted', value: contactedLeads, fill: '#83a6ed' },
            { id: 'qualified', name: 'Qualified', value: qualifiedLeads, fill: '#8dd1e1' },
            { id: 'demo', name: 'Demo Set', value: demosScheduled, fill: '#82ca9d' },
            { id: 'won', name: 'Closed Won', value: closedWon, fill: '#a4de6c' },
        ]

        return NextResponse.json(funnelData)
    } catch (error) {
        console.error('[Analytics Funnel] Error:', error)
        return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 })
    }
}
