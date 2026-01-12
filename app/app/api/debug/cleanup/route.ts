
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Safety check: specific user or role if needed, but for now just the blocked user
        if (currentUser.email !== 'vijay@atomicwork.com') {
            return NextResponse.json({ error: 'Unauthorized: Admin only' }, { status: 403 })
        }

        // Find leads with no companyId for this user
        const ghostLeads = await prisma.lead.count({
            where: {
                userId: currentUser.userId,
                companyId: null
            }
        })

        if (ghostLeads === 0) {
            return NextResponse.json({ message: 'No ghost leads found to clean up.' })
        }

        // Delete them
        const deleted = await prisma.lead.deleteMany({
            where: {
                userId: currentUser.userId,
                companyId: null
            }
        })

        return NextResponse.json({
            success: true,
            message: `Cleaned up ${deleted.count} ghost leads (missing companyId).`,
            previousCount: ghostLeads
        })

    } catch (error) {
        console.error('Cleanup error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
