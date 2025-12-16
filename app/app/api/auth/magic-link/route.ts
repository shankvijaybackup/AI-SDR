import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendMagicLinkEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const magicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// POST - Send magic link
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = magicLinkSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        message: 'If an account exists with this email, a magic link has been sent.',
      })
    }

    // Generate magic link token
    const magicToken = randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: {
        magicLinkToken: magicToken,
        magicLinkExpiry: tokenExpiry,
      },
    })

    // Generate magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const magicLinkUrl = `${baseUrl}/auth/magic?token=${magicToken}`

    // Send magic link email
    const emailResult = await sendMagicLinkEmail(
      user.email,
      user.firstName,
      magicLinkUrl
    )

    console.log(`[MagicLink] Login URL for ${email}: ${magicLinkUrl}`)
    console.log(`[MagicLink] Email sent: ${emailResult.success}`)

    return NextResponse.json({
      message: 'If an account exists with this email, a magic link has been sent.',
      magicLinkUrl, // Include in response for testing
      emailSent: emailResult.success,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Magic link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
