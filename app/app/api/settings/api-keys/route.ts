import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'
import { isAdmin } from '@/lib/permissions'
import { z } from 'zod'

// NOTE: DB columns repurposed after OpenAI/Gemini removal:
//   openaiApiKey    → anthropicApiKey
//   googleAiApiKey  → groqApiKey
//   elevenLabsApiKey → voyageApiKey
// No migration needed — just renaming semantics at the API layer.

const updateApiKeysSchema = z.object({
    twilioAccountSid: z.string().optional().nullable(),
    twilioAuthToken: z.string().optional().nullable(),
    anthropicApiKey: z.string().optional().nullable(),
    groqApiKey: z.string().optional().nullable(),
    voyageApiKey: z.string().optional().nullable(),
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
                anthropicApiKey: maskKey(settings.openaiApiKey),    // repurposed column
                groqApiKey: maskKey(settings.googleAiApiKey),        // repurposed column
                voyageApiKey: maskKey(settings.elevenLabsApiKey),    // repurposed column
                deepgramApiKey: maskKey(settings.deepgramApiKey),
            },
            hasKeys: {
                twilio: !!settings.twilioAccountSid,
                anthropic: !!settings.openaiApiKey,
                groq: !!settings.googleAiApiKey,
                voyage: !!settings.elevenLabsApiKey,
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

        // Map new field names to DB column names
        const dbData: Record<string, string> = {}
        if (validatedData.twilioAccountSid) dbData.twilioAccountSid = validatedData.twilioAccountSid
        if (validatedData.twilioAuthToken) dbData.twilioAuthToken = validatedData.twilioAuthToken
        if (validatedData.anthropicApiKey) dbData.openaiApiKey = validatedData.anthropicApiKey    // repurposed
        if (validatedData.groqApiKey) dbData.googleAiApiKey = validatedData.groqApiKey            // repurposed
        if (validatedData.voyageApiKey) dbData.elevenLabsApiKey = validatedData.voyageApiKey      // repurposed
        if (validatedData.deepgramApiKey) dbData.deepgramApiKey = validatedData.deepgramApiKey

        // Upsert settings
        const settings = await prisma.companySettings.upsert({
            where: { companyId: currentUser.companyId },
            create: {
                companyId: currentUser.companyId,
                ...dbData,
                trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            },
            update: dbData,
        })

        return NextResponse.json({
            message: 'API keys updated successfully',
            hasKeys: {
                twilio: !!settings.twilioAccountSid,
                anthropic: !!settings.openaiApiKey,
                groq: !!settings.googleAiApiKey,
                voyage: !!settings.elevenLabsApiKey,
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
