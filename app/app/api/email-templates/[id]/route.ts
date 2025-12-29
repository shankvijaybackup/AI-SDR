import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET /api/email-templates/[id] - Get a specific template
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const template = await prisma.emailTemplate.findFirst({
            where: { id, companyId: user.companyId }
        })

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        return NextResponse.json(template)
    } catch (error) {
        console.error('[Email Templates] Error:', error)
        return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
    }
}

// PUT /api/email-templates/[id] - Update a template
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can update templates' }, { status: 403 })
        }

        // Verify template belongs to company
        const existing = await prisma.emailTemplate.findFirst({
            where: { id, companyId: user.companyId }
        })

        if (!existing) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        const body = await request.json()
        const { name, subject, body: templateBody, triggerType, delayMinutes, isActive } = body

        const template = await prisma.emailTemplate.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(subject && { subject }),
                ...(templateBody && { body: templateBody }),
                ...(triggerType && { triggerType }),
                ...(delayMinutes !== undefined && { delayMinutes }),
                ...(isActive !== undefined && { isActive })
            }
        })

        return NextResponse.json(template)
    } catch (error) {
        console.error('[Email Templates] Error:', error)
        return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }
}

// DELETE /api/email-templates/[id] - Delete a template
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can delete templates' }, { status: 403 })
        }

        // Verify template belongs to company
        const existing = await prisma.emailTemplate.findFirst({
            where: { id, companyId: user.companyId }
        })

        if (!existing) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        await prisma.emailTemplate.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[Email Templates] Error:', error)
        return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }
}
