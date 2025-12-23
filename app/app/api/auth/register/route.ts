import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  company: z.string().min(1, 'Company name is required'),  // Required for multi-tenancy
  inviteToken: z.string().optional(),  // If joining existing company
})

// Generate URL-friendly slug from company name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') + '-' + Math.random().toString(36).substring(2, 8)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(validatedData.password)

    let companyId: string
    let userRole = 'member'

    // Check if joining via invite
    if (validatedData.inviteToken) {
      const invite = await prisma.companyInvite.findUnique({
        where: { token: validatedData.inviteToken },
        include: { company: true }
      })

      if (!invite || invite.expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Invalid or expired invite' },
          { status: 400 }
        )
      }

      if (invite.email.toLowerCase() !== validatedData.email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email does not match invite' },
          { status: 400 }
        )
      }

      companyId = invite.companyId
      userRole = invite.role

      // Delete the invite after use
      await prisma.companyInvite.delete({ where: { id: invite.id } })
    } else {
      // Create new company (user is admin)
      const company = await prisma.company.create({
        data: {
          name: validatedData.company,
          slug: generateSlug(validatedData.company),
          plan: 'trial',
          billingEmail: validatedData.email,
        }
      })
      companyId = company.id
      userRole = 'admin'
    }

    // Create user with company
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        companyName: validatedData.company,
        companyId: companyId,
        role: userRole,
        isActive: true,  // Auto-activate for now
      },
    })

    const token = generateToken({
      userId: user.id,
      email: user.email,
      companyId: companyId,
      role: userRole,
    })

    await setAuthCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: companyId,
        role: userRole,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
