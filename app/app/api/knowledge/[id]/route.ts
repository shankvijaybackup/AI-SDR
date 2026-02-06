import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const knowledgeSource = await prisma.knowledgeSource.findFirst({
            where: {
                id,
                OR: [
                    { isShared: true },
                    { userId: currentUser.userId },
                ],
            },
        })

        if (!knowledgeSource) {
            return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
        }

        return NextResponse.json({ knowledgeSource })
    } catch (error) {
        console.error('Get knowledge source error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const body = await request.json()
        const { title, description, category, tags } = body

        // Check if user has permission to edit
        const existing = await prisma.knowledgeSource.findFirst({
            where: {
                id,
                OR: [
                    { isShared: true },
                    { userId: currentUser.userId },
                ],
            },
        })

        if (!existing) {
            return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
        }

        // Update only provided fields
        const updateData: any = {}
        if (title !== undefined) updateData.title = title
        if (description !== undefined) updateData.description = description
        if (category !== undefined) updateData.category = category
        if (tags !== undefined) {
            // Handle tags as array or comma-separated string
            updateData.tags = Array.isArray(tags)
                ? tags
                : tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        }

        const updated = await prisma.knowledgeSource.update({
            where: { id },
            data: updateData,
        })

        return NextResponse.json({ knowledgeSource: updated })
    } catch (error) {
        console.error('Update knowledge source error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
