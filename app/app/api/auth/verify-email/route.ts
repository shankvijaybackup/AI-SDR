import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { z } from 'zod'

const verifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

// POST - Verify email and activate account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = verifySchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification link' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
      return NextResponse.json(
        { error: 'Verification link has expired. Please contact an administrator for a new invitation.' },
        { status: 400 }
      )
    }

    // Activate user and verify email
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        lastLoginAt: new Date(),
      },
    })

    // Generate JWT and set cookie (auto-login after verification)
    const jwtToken = generateToken({
      userId: user.id,
      email: user.email,
    })

    await setAuthCookie(jwtToken)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      message: 'Email verified and account activated successfully!',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
