import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest, hashPassword } from '@/lib/auth'

// POST - Reset password for a user (authenticated users only)
export async function POST(request: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { userId, newPassword } = body

        if (!userId || !newPassword) {
            return NextResponse.json({ error: 'userId and newPassword required' }, { status: 400 })
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
        }

        // Hash the new password
        const hashedPassword = await hashPassword(newPassword)

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
            select: { id: true, email: true, firstName: true, lastName: true }
        })

        return NextResponse.json({
            success: true,
            message: `Password reset for ${updatedUser.email}`,
            user: updatedUser
        })
    } catch (error) {
        console.error('Password reset error:', error)
        return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
    }
}
