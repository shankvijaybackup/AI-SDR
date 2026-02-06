import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { isAdmin } from '@/lib/permissions'
import { z } from 'zod'

const updateOrgSchema = z.object({
    name: z.string().min(1).optional(),
    billingEmail: z.string().email().optional(),
})

// GET - Fetch organization details
export async function GET(request: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        if (!currentUser.companyId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 })
        }

        const company = await prisma.company.findUnique({
            where: { id: currentUser.companyId },
            include: {
                settings: true,
                _count: {
                    select: {
                        users: true,
                        leads: true,
                        calls: true,
                    }
                }
            }
        })

        if (!company) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
        }

        // Return company info (settings only visible to admins)
        const isUserAdmin = isAdmin(currentUser.role || 'member')

        return NextResponse.json({
            organization: {
                id: company.id,
                name: company.name,
                slug: company.slug,
                plan: company.plan,
                billingEmail: isUserAdmin ? company.billingEmail : null,
                createdAt: company.createdAt,
                stats: company._count,
                settings: isUserAdmin ? {
                    aiCallingEnabled: company.settings?.aiCallingEnabled ?? true,
                    knowledgeBaseEnabled: company.settings?.knowledgeBaseEnabled ?? true,
                    trialEndsAt: company.settings?.trialEndsAt,
                    subscriptionStatus: company.settings?.subscriptionStatus,
                    // API keys are masked
                    hasOpenaiKey: !!company.settings?.openaiApiKey,
                    hasTwilioKey: !!company.settings?.twilioAccountSid,
                    hasElevenLabsKey: !!company.settings?.elevenLabsApiKey,
                    hasDeepgramKey: !!company.settings?.deepgramApiKey,
                    hasGoogleAiKey: !!company.settings?.googleAiApiKey,
                    hubspotConnected: !!company.settings?.hubspotConnected,
                    amplemarketConnected: !!company.settings?.amplemarketApiKey,
                } : null,
            },
            isAdmin: isUserAdmin,
        })
    } catch (error) {
        console.error('Get organization error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH - Update organization (admin only)
export async function PATCH(request: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Check admin permission
        if (!isAdmin(currentUser.role || 'member')) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        if (!currentUser.companyId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 })
        }

        const body = await request.json()
        const validatedData = updateOrgSchema.parse(body)

        const company = await prisma.company.update({
            where: { id: currentUser.companyId },
            data: validatedData,
        })

        return NextResponse.json({
            organization: {
                id: company.id,
                name: company.name,
                slug: company.slug,
                billingEmail: company.billingEmail,
            },
            message: 'Organization updated successfully',
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
        }
        console.error('Update organization error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
