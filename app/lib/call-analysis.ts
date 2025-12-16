import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface TranscriptEntry {
  speaker: string
  text: string
  timestamp: string
}

interface CallAnalysis {
  aiSummary: string
  interestLevel: 'high' | 'medium' | 'low' | 'not_interested'
  objections: string[]
  emailCaptured: string | null
  nextSteps: string | null
  scheduledDemo: Date | null
}

export async function analyzeCall(
  transcript: TranscriptEntry[],
  leadName: string,
  company: string
): Promise<CallAnalysis> {
  // Check if transcript has meaningful content
  if (!transcript || transcript.length < 2) {
    console.log('[Call Analysis] Insufficient transcript data, skipping analysis')
    return {
      aiSummary: 'Call ended without meaningful conversation.',
      interestLevel: 'low',
      objections: [],
      emailCaptured: null,
      nextSteps: null,
      scheduledDemo: null,
    }
  }

  const transcriptText = transcript
    .map((entry) => `${entry.speaker}: ${entry.text}`)
    .join('\n')

  // Check if transcript has actual content (not just greetings)
  if (transcriptText.length < 50) {
    console.log('[Call Analysis] Transcript too short, skipping analysis')
    return {
      aiSummary: 'Call ended prematurely.',
      interestLevel: 'low',
      objections: [],
      emailCaptured: null,
      nextSteps: null,
      scheduledDemo: null,
    }
  }

  const prompt = `Analyze this sales call transcript and provide structured insights:

TRANSCRIPT:
${transcriptText}

LEAD: ${leadName} from ${company}

Provide a JSON response with:
1. aiSummary: A concise 2-3 sentence summary of the call
2. interestLevel: Rate as "high", "medium", "low", or "not_interested"
3. objections: Array of objections raised by the lead
4. emailCaptured: Email address if mentioned, otherwise null
5. nextSteps: What should happen next (follow-up, demo, etc.)
6. scheduledDemo: ISO date string if demo was scheduled, otherwise null

Focus on:
- Lead's pain points and needs
- Buying signals or resistance
- Specific objections raised
- Any commitments made
- Email or contact info shared
- Demo or meeting scheduled

Return ONLY valid JSON, no markdown or explanations.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sales call analyst. Analyze transcripts and return structured JSON insights.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    const analysis = JSON.parse(content)

    return {
      aiSummary: analysis.aiSummary || 'Call completed',
      interestLevel: analysis.interestLevel || 'medium',
      objections: Array.isArray(analysis.objections) ? analysis.objections : [],
      emailCaptured: analysis.emailCaptured || null,
      nextSteps: analysis.nextSteps || null,
      scheduledDemo: analysis.scheduledDemo ? new Date(analysis.scheduledDemo) : null,
    }
  } catch (error) {
    console.error('Call analysis error:', error)
    // Return default values if analysis fails
    return {
      aiSummary: 'Call completed. Analysis unavailable.',
      interestLevel: 'medium',
      objections: [],
      emailCaptured: null,
      nextSteps: null,
      scheduledDemo: null,
    }
  }
}
