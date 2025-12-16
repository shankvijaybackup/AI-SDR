import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, setAuthCookie } from '@/lib/auth'
import { z } from 'zod'

const verifySchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

// POST - Verify magic link and login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = verifySchema.parse(body)

    const user = await prisma.user.findFirst({
      where: { magicLinkToken: token },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired magic link' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (user.magicLinkExpiry && user.magicLinkExpiry < new Date()) {
      return NextResponse.json(
        { error: 'Magic link has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your account is not activated. Please contact an administrator.' },
        { status: 403 }
      )
    }

    // Clear magic link token and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        magicLinkToken: null,
        magicLinkExpiry: null,
        lastLoginAt: new Date(),
        isEmailVerified: true, // Verify email on magic link login
      },
    })

    // Generate JWT and set cookie
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
      message: 'Login successful',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Magic link verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
