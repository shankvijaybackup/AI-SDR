import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { isAdmin } from '@/lib/permissions'
import { z } from 'zod'

const updateApiKeysSchema = z.object({
    twilioAccountSid: z.string().optional().nullable(),
    twilioAuthToken: z.string().optional().nullable(),
    openaiApiKey: z.string().optional().nullable(),
    googleAiApiKey: z.string().optional().nullable(),
    elevenLabsApiKey: z.string().optional().nullable(),
    deepgramApiKey: z.string().optional().nullable(),
})

// GET - Fetch API keys (masked)
export async function GET(request: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Admin only
        if (!isAdmin(currentUser.role || 'member')) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        if (!currentUser.companyId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 })
        }

        // Get or create settings
        let settings = await prisma.companySettings.findUnique({
            where: { companyId: currentUser.companyId },
        })

        if (!settings) {
            settings = await prisma.companySettings.create({
                data: {
                    companyId: currentUser.companyId,
                    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
                }
            })
        }

        // Return masked keys (show last 4 chars only)
        const maskKey = (key: string | null) => {
            if (!key) return null
            if (key.length <= 8) return '••••••••'
            return '••••••••' + key.slice(-4)
        }

        return NextResponse.json({
            apiKeys: {
                twilioAccountSid: maskKey(settings.twilioAccountSid),
                twilioAuthToken: maskKey(settings.twilioAuthToken),
                openaiApiKey: maskKey(settings.openaiApiKey),
                googleAiApiKey: maskKey(settings.googleAiApiKey),
                elevenLabsApiKey: maskKey(settings.elevenLabsApiKey),
                deepgramApiKey: maskKey(settings.deepgramApiKey),
            },
            // Indicate which keys are set
            hasKeys: {
                twilio: !!settings.twilioAccountSid,
                openai: !!settings.openaiApiKey,
                googleAi: !!settings.googleAiApiKey,
                elevenLabs: !!settings.elevenLabsApiKey,
                deepgram: !!settings.deepgramApiKey,
            },
            featureFlags: {
                aiCallingEnabled: settings.aiCallingEnabled,
                knowledgeBaseEnabled: settings.knowledgeBaseEnabled,
            },
        })
    } catch (error) {
        console.error('Get API keys error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// PATCH - Update API keys (admin only)
export async function PATCH(request: NextRequest) {
    try {
        const currentUser = getCurrentUserFromRequest(request)
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Admin only
        if (!isAdmin(currentUser.role || 'member')) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }

        if (!currentUser.companyId) {
            return NextResponse.json({ error: 'No organization found' }, { status: 404 })
        }

        const body = await request.json()
        const validatedData = updateApiKeysSchema.parse(body)

        // Filter out null values (don't overwrite existing keys with null)
        const updateData: Record<string, string> = {}
        for (const [key, value] of Object.entries(validatedData)) {
            if (value !== null && value !== undefined && value !== '') {
                updateData[key] = value
            }
        }

        // Upsert settings
        const settings = await prisma.companySettings.upsert({
            where: { companyId: currentUser.companyId },
            create: {
                companyId: currentUser.companyId,
                ...updateData,
                trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
            update: updateData,
        })

        return NextResponse.json({
            message: 'API keys updated successfully',
            hasKeys: {
                twilio: !!settings.twilioAccountSid,
                openai: !!settings.openaiApiKey,
                googleAi: !!settings.googleAiApiKey,
                elevenLabs: !!settings.elevenLabsApiKey,
                deepgram: !!settings.deepgramApiKey,
            },
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 })
        }
        console.error('Update API keys error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
