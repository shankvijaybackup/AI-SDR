import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status')

    // Multi-tenancy: Show shared knowledge + user's own knowledge
    const where: any = {
      isActive: true,
      OR: [
        { isShared: true },  // Shared knowledge visible to all
        { userId: currentUser.userId },  // User's own knowledge
      ],
    }

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    }

    const knowledgeSources = await prisma.knowledgeSource.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        category: true,
        tags: true,
        status: true,
        summary: true,
        fileSize: true,
        fileName: true,
        videoUrl: true,
        isShared: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ knowledgeSources })
  } catch (error) {
    console.error('Get knowledge sources error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    // Multi-tenancy: Can delete if shared or owned by user
    await prisma.knowledgeSource.delete({
      where: {
        id,
        OR: [
          { isShared: true },  // Can delete shared knowledge
          { userId: currentUser.userId },  // Can delete own knowledge
        ],
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete knowledge source error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
