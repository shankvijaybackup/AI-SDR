import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import bcrypt from 'bcrypt'

// POST - Reset password for a user (admin only)
export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAuth(request)
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Only admins can reset passwords
        if (auth.role !== 'admin') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
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
        const hashedPassword = await bcrypt.hash(newPassword, 12)

        // Update user
        const user = await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
            select: { id: true, email: true, firstName: true, lastName: true }
        })

        return NextResponse.json({
            success: true,
            message: `Password reset for ${user.email}`,
            user
        })
    } catch (error) {
        console.error('Password reset error:', error)
        return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
    }
}
