import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { sendInvitationEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.string().optional().default('SDR'),
})

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = inviteSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Generate verification token
    const verificationToken = randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create user with temporary password (they'll use magic link)
    const tempPassword = randomBytes(16).toString('hex')
    
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        password: tempPassword, // Temporary - user will use magic link
        role: validatedData.role || 'SDR',
        isActive: false,
        isEmailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: tokenExpiry,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
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
      validatedData.firstName,
      verificationUrl,
      inviterName
    )

    console.log(`[Invite] Verification URL for ${user.email}: ${verificationUrl}`)
    console.log(`[Invite] Email sent: ${emailResult.success}`)

    return NextResponse.json({
      user,
      verificationUrl, // Include in response for testing
      emailSent: emailResult.success,
      message: emailResult.success 
        ? `Invitation email sent to ${user.email}` 
        : `User created. Email not sent (configure RESEND_API_KEY). Use the verification link below.`,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Invite user error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
