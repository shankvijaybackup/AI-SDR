import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const updateScriptSchema = z.object({
  name: z.string().optional(),
  content: z.string().optional(),
  isDefault: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const script = await prisma.script.findFirst({
      where: {
        id: id,
        userId: currentUser.userId,
      },
    })

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 })
    }

    return NextResponse.json({ script })
  } catch (error) {
    console.error('Get script error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateScriptSchema.parse(body)

    const script = await prisma.script.findFirst({
      where: {
        id: id,
        userId: currentUser.userId,
      },
    })

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 })
    }

    // If setting as default, unset other defaults
    if (validatedData.isDefault) {
      await prisma.script.updateMany({
        where: {
          userId: currentUser.userId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    const updatedScript = await prisma.script.update({
      where: { id: id },
      data: validatedData,
    })

    return NextResponse.json({ script: updatedScript })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Update script error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Use deleteMany to properly support OR clause (same fix as knowledge sources)
    // Scripts can be shared (isShared: true) OR owned by user (userId: currentUser.userId)
    const deleteResult = await prisma.script.deleteMany({
      where: {
        id: id,
        OR: [
          { isShared: true },
          { userId: currentUser.userId },
        ],
      },
    })

    if (deleteResult.count === 0) {
      return NextResponse.json({ error: 'Script not found or no permission' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete script error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
