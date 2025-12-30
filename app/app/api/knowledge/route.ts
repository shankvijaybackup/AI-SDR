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
    const ids = searchParams.get('ids')

    // Support both single and bulk deletion
    if (!id && !ids) {
      return NextResponse.json({ error: 'ID or IDs are required' }, { status: 400 })
    }

    if (ids) {
      // Bulk deletion
      const idArray = ids.split(',').map(i => i.trim()).filter(Boolean)

      if (idArray.length === 0) {
        return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 })
      }

      // Delete multiple knowledge sources
      const result = await prisma.knowledgeSource.deleteMany({
        where: {
          id: { in: idArray },
          OR: [
            { isShared: true },
            { userId: currentUser.userId },
          ],
        },
      })

      return NextResponse.json({
        success: true,
        count: result.count,
        message: `Deleted ${result.count} knowledge source(s)`
      })
    } else {
      // Single deletion - use deleteMany since delete() doesn't support OR
      const result = await prisma.knowledgeSource.deleteMany({
        where: {
          id: id!,
          OR: [
            { isShared: true },
            { userId: currentUser.userId },
          ],
        },
      })

      if (result.count === 0) {
        return NextResponse.json({ error: 'Knowledge source not found or no permission' }, { status: 404 })
      }

      return NextResponse.json({ success: true, count: 1 })
    }
  } catch (error) {
    console.error('Delete knowledge source error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
