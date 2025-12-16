import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { sendInvitationEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const resendSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { userId } = resendSchema.parse(body)

    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.isEmailVerified && user.isActive) {
      return NextResponse.json({ 
        error: 'User is already verified and active' 
      }, { status: 400 })
    }

    // Generate new verification token
    const verificationToken = randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Update user with new token
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: tokenExpiry,
      },
    })

    // Generate verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verificationUrl = `${baseUrl}/auth/verify?token=${verificationToken}`

    // Get inviter's name for email
    const inviter = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { firstName: true, lastName: true },
    })
    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : undefined

    // Send invitation email
    const emailResult = await sendInvitationEmail(
      user.email,
      user.firstName,
      verificationUrl,
      inviterName
    )

    console.log(`[Resend] Verification URL for ${user.email}: ${verificationUrl}`)
    console.log(`[Resend] Email sent: ${emailResult.success}`)

    return NextResponse.json({
      success: true,
      verificationUrl,
      emailSent: emailResult.success,
      message: emailResult.success 
        ? `Verification email resent to ${user.email}` 
        : `New token generated. Email not sent. Use the verification link.`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Resend verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
