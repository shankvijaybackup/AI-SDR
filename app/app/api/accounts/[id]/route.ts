
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params

        const account = await prisma.account.findUnique({
            where: { id },
            include: {
                leads: {
                    take: 50,
                    orderBy: { createdAt: 'desc' }
                }
            }
        })

        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 })
        }

        if (account.companyId && account.companyId !== user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        return NextResponse.json(account)
    } catch (error) {
        console.error('Error fetching account:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const body = await req.json()

        const existing = await prisma.account.findUnique({ where: { id } })
        if (!existing || (existing.companyId && existing.companyId !== user.companyId)) {
            return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
        }

        const updated = await prisma.account.update({
            where: { id },
            data: body
        })

        return NextResponse.json(updated)

    } catch (error) {
        console.error('Error updating account:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params

        const existing = await prisma.account.findUnique({ where: { id } })
        if (!existing || (existing.companyId && existing.companyId !== user.companyId)) {
            return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 })
        }

        await prisma.account.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting account:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
