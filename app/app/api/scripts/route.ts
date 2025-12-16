import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const createScriptSchema = z.object({
  name: z.string().min(1, 'Script name is required'),
  content: z.string().min(1, 'Script content is required'),
  isDefault: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Multi-tenancy: Show shared scripts + user's own scripts
    const scripts = await prisma.script.findMany({
      where: {
        OR: [
          { isShared: true },  // Shared scripts visible to all
          { userId: currentUser.userId },  // User's own scripts
        ],
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({ scripts })
  } catch (error) {
    console.error('Get scripts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createScriptSchema.parse(body)

    // If setting as default, unset other defaults for shared scripts
    if (validatedData.isDefault) {
      await prisma.script.updateMany({
        where: {
          isShared: true,
          isDefault: true,
        },
        data: { isDefault: false },
      })
    }

    // Multi-tenancy: Scripts are shared by default
    const script = await prisma.script.create({
      data: {
        ...validatedData,
        userId: null,  // Shared scripts have no owner
        isShared: true,
        createdBy: currentUser.userId,  // Track who created it
      },
    })

    return NextResponse.json({ script })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Create script error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
