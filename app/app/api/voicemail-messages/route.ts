import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request)
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const messages = await prisma.voicemailMessage.findMany({
            where: { companyId: user.companyId },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json({ messages })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request)
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { name, audioUrl, isDefault } = body

        if (!name || !audioUrl) {
            return NextResponse.json({ error: 'Name and Audio URL are required' }, { status: 400 })
        }

        // If setting as default, unset others
        if (isDefault) {
            await prisma.voicemailMessage.updateMany({
                where: { companyId: user.companyId },
                data: { isDefault: false }
            })
        }

        const message = await prisma.voicemailMessage.create({
            data: {
                companyId: user.companyId,
                name,
                audioUrl,
                isDefault: isDefault || false,
                isActive: true
            }
        })

        return NextResponse.json({ message })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create message' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request)
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 })
        }

        await prisma.voicemailMessage.deleteMany({
            where: {
                id,
                companyId: user.companyId // Ensure ownership
            }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request)
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { id, isDefault, isActive } = body

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

        if (isDefault) {
            // If setting as default, unset others first
            await prisma.voicemailMessage.updateMany({
                where: { companyId: user.companyId },
                data: { isDefault: false }
            })
        }

        const message = await prisma.voicemailMessage.update({
            where: { id, companyId: user.companyId },
            data: {
                ...(isDefault !== undefined && { isDefault }),
                ...(isActive !== undefined && { isActive })
            }
        })

        return NextResponse.json({ message })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
    }
}
