import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET /api/email-templates - List all email templates for the company
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const templates = await prisma.emailTemplate.findMany({
            where: { companyId: user.companyId },
            orderBy: { createdAt: 'desc' }
        })

        return NextResponse.json(templates)
    } catch (error) {
        console.error('[Email Templates] Error:', error)
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }
}

// POST /api/email-templates - Create a new email template
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can create templates' }, { status: 403 })
        }

        const body = await request.json()
        const { name, subject, body: templateBody, triggerType, delayMinutes } = body

        if (!name || !subject || !templateBody || !triggerType) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Validate trigger type
        const validTriggerTypes = [
            'post_call_high',
            'post_call_medium',
            'post_call_low',
            'post_call_not_interested',
            'demo_reminder',
            'follow_up',
            'voicemail'
        ]
        if (!validTriggerTypes.includes(triggerType)) {
            return NextResponse.json({ error: 'Invalid trigger type' }, { status: 400 })
        }

        const template = await prisma.emailTemplate.create({
            data: {
                companyId: user.companyId,
                name,
                subject,
                body: templateBody,
                triggerType,
                delayMinutes: delayMinutes || 0,
                isActive: true
            }
        })

        return NextResponse.json(template, { status: 201 })
    } catch (error) {
        console.error('[Email Templates] Error:', error)
        return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }
}
