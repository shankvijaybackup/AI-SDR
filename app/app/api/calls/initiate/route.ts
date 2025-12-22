import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { buildContextualScript } from '@/lib/linkedin-enrichment'
import { z } from 'zod'

const initiateCallSchema = z.object({
  leadId: z.string(),
  scriptId: z.string(),
  // voicePersona removed - backend auto-selects from voice pool
})

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = initiateCallSchema.parse(body)

    // Fetch lead
    const lead = await prisma.lead.findFirst({
      where: {
        id: validatedData.leadId,
        userId: currentUser.userId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        jobTitle: true,
        linkedinUrl: true,
        region: true,
        linkedinEnriched: true,
        linkedinData: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Fetch script - allow user's own scripts OR shared scripts
    const script = await prisma.script.findFirst({
      where: {
        id: validatedData.scriptId,
        OR: [
          { userId: currentUser.userId },
          { isShared: true },
          { userId: null }, // Scripts without owner (default/seeded scripts)
        ],
      },
    })

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 })
    }

    // Fetch user's knowledge sources for context
    const knowledgeSources = await prisma.knowledgeSource.findMany({
      where: { userId: currentUser.userId },
      select: {
        title: true,
        type: true,
        content: true,
      },
      take: 5, // Limit to prevent context overload
    })

    // Create call record (voicePersona will be set by backend)
    const call = await prisma.call.create({
      data: {
        userId: currentUser.userId,
        leadId: lead.id,
        scriptId: script.id,
        voicePersona: 'auto', // Backend auto-selects from voice pool
        status: 'initiated',
        transcript: [],
      },
    })

    // Prepare script with variables replaced
    let personalizedScript = script.content
      .replace(/\{\{firstName\}\}/g, lead.firstName)
      .replace(/\{\{lastName\}\}/g, lead.lastName)
      .replace(/\{\{company\}\}/g, lead.company || '')
      .replace(/\{\{jobTitle\}\}/g, lead.jobTitle || '')
      .replace(/\{\{repName\}\}/g, 'Alex')

    // Build contextual script using LinkedIn enriched data if available
    if (lead.linkedinEnriched && lead.linkedinData) {
      console.log('[Call] Building contextual script with enriched data')
      personalizedScript = buildContextualScript(
        personalizedScript,
        {
          firstName: lead.firstName,
          lastName: lead.lastName,
          company: lead.company,
          jobTitle: lead.jobTitle,
        },
        lead.linkedinData as any
      )
    }

    // Add knowledge base context for AI
    if (knowledgeSources.length > 0) {
      console.log(`[Call] Adding ${knowledgeSources.length} knowledge sources to context`)

      // Build knowledge context string
      const knowledgeContext = knowledgeSources.map(source => {
        // Truncate content to prevent context overload
        const truncatedContent = source.content.length > 1000
          ? source.content.substring(0, 1000) + '...'
          : source.content
        return `=== ${source.title} (${source.type}) ===\n${truncatedContent}`
      }).join('\n\n')

      personalizedScript += `\n\n=== PRODUCT KNOWLEDGE ===
Use the following knowledge when discussing our solution:

${knowledgeContext}

Remember to:
- Connect the prospect's pain points to our solution
- Use relevant talking points based on their role and interests
- Reference specific features that address their focus areas`
    }

    // Call Twilio backend to initiate call
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:4000'

    try {
      const twilioResponse = await fetch(`${backendUrl}/api/twilio/initiate-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callId: call.id,
          phoneNumber: lead.phone,
          script: personalizedScript,
          // voicePersona removed - backend auto-selects
          leadName: `${lead.firstName} ${lead.lastName}`,
          leadEmail: lead.email,
          region: lead.region, // Pass the lead's region for voice selection
        }),
      })

      if (!twilioResponse.ok) {
        throw new Error('Failed to initiate Twilio call')
      }

      const twilioData = await twilioResponse.json()

      // Update call with Twilio SID
      await prisma.call.update({
        where: { id: call.id },
        data: {
          twilioCallSid: twilioData.callSid,
          status: 'calling',
        },
      })

      return NextResponse.json({
        callId: call.id,
        callSid: twilioData.callSid,
        status: 'calling',
      })
    } catch (twilioError) {
      // Update call status to failed
      await prisma.call.update({
        where: { id: call.id },
        data: { status: 'failed' },
      })

      console.error('Twilio call initiation error:', twilioError)
      return NextResponse.json(
        { error: 'Failed to initiate call with Twilio' },
        { status: 500 }
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Initiate call error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
