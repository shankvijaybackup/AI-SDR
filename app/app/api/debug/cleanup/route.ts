
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Safety check: specific user or role if needed, but for now just the blocked user
        if (currentUser.email !== 'vijay@atomicwork.com') {
            return NextResponse.json({ error: 'Unauthorized: Admin only' }, { status: 403 })
        }

        // Aggressive cleanup: Delete ALL leads for this user to allow a fresh start
        // This is necessary because some leads might have been created with inconsistent states during debugging.
        const deleted = await prisma.lead.deleteMany({
            where: {
                userId: currentUser.userId
            }
        })

        return NextResponse.json({
            success: true,
            message: `AGGRESSIVE CLEANUP: Deleted ${deleted.count} leads. You can now re-import safely.`,
        })

    } catch (error) {
        console.error('Cleanup error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
