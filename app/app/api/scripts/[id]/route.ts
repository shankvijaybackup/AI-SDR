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

    // First, find the script to check permissions
    const script = await prisma.script.findUnique({
      where: { id: id },
    })

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 })
    }

    // Check if user can delete this script:
    // 1. Script is shared (isShared: true) - anyone can delete
    // 2. Script belongs to the user (userId matches)
    // 3. Script belongs to user's company (companyId matches)
    const canDelete =
      script.isShared ||
      script.userId === currentUser.userId ||
      (script.companyId && script.companyId === currentUser.companyId)

    if (!canDelete) {
      return NextResponse.json({ error: 'No permission to delete this script' }, { status: 403 })
    }

    // Delete the script
    await prisma.script.delete({
      where: { id: id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete script error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
