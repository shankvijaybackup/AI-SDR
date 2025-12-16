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
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const script = await prisma.script.findFirst({
      where: {
        id: params.id,
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
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateScriptSchema.parse(body)

    const script = await prisma.script.findFirst({
      where: {
        id: params.id,
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
          id: { not: params.id },
        },
        data: { isDefault: false },
      })
    }

    const updatedScript = await prisma.script.update({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const script = await prisma.script.findFirst({
      where: {
        id: params.id,
        userId: currentUser.userId,
      },
    })

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 })
    }

    await prisma.script.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete script error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
