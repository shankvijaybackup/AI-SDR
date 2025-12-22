import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface TranscriptEntry {
  speaker: string
  text: string
  timestamp?: string
}

interface CallAnalysis {
  aiSummary: string
  interestLevel: 'high' | 'medium' | 'low' | 'not_interested'
  objections: string[]
  emailCaptured: string | null
  nextSteps: string | null
  scheduledDemo: Date | null
  // NEW: Enhanced analysis fields
  fullTranscript: TranscriptEntry[]
  toneAnalysis: {
    prospectTone: string
    agentTone: string
    overallSentiment: 'positive' | 'neutral' | 'negative'
  }
  whatWentWell: string[]
  whatWentWrong: string[]
  coachingFeedback: string
  callDuration: string
  keyMoments: { timestamp: string; description: string }[]
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
      fullTranscript: transcript || [],
      toneAnalysis: {
        prospectTone: 'Unable to determine',
        agentTone: 'Unable to determine',
        overallSentiment: 'neutral',
      },
      whatWentWell: [],
      whatWentWrong: ['Call ended too quickly to gather meaningful insights'],
      coachingFeedback: 'Try to engage the prospect longer before they disengage.',
      callDuration: 'Very short',
      keyMoments: [],
    }
  }

  const transcriptText = transcript
    .map((entry, idx) => `[${idx + 1}] ${entry.speaker === 'agent' ? 'Alex (Agent)' : 'Prospect'}: ${entry.text}`)
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
      fullTranscript: transcript,
      toneAnalysis: {
        prospectTone: 'Unable to determine',
        agentTone: 'Unable to determine',
        overallSentiment: 'neutral',
      },
      whatWentWell: [],
      whatWentWrong: ['Call was too short for meaningful analysis'],
      coachingFeedback: 'Aim to keep prospects engaged for at least 2-3 exchanges.',
      callDuration: 'Very short',
      keyMoments: [],
    }
  }

  const prompt = `You are an expert sales coach analyzing a cold call. Provide comprehensive, actionable feedback.

FULL TRANSCRIPT:
${transcriptText}

LEAD: ${leadName} from ${company}

Analyze this call thoroughly and return a JSON object with these fields:

{
  "aiSummary": "3-4 sentence executive summary of the call - what happened, outcome, and key takeaway",
  
  "interestLevel": "high" | "medium" | "low" | "not_interested",
  
  "objections": ["Array of specific objections the prospect raised"],
  
  "emailCaptured": "email@example.com or null",
  
  "nextSteps": "What should happen next based on the call outcome",
  
  "scheduledDemo": "ISO date string if demo scheduled, or null",
  
  "toneAnalysis": {
    "prospectTone": "Describe the prospect's tone (e.g., 'Initially skeptical but warmed up', 'Frustrated and dismissive', 'Curious and engaged')",
    "agentTone": "Describe the agent's tone (e.g., 'Professional and empathetic', 'Rushed and pushy', 'Natural and conversational')",
    "overallSentiment": "positive" | "neutral" | "negative"
  },
  
  "whatWentWell": [
    "Specific things the agent did RIGHT - be concrete (e.g., 'Good use of open-ended questions', 'Effectively handled the pricing objection')"
  ],
  
  "whatWentWrong": [
    "Specific things that could be improved - be constructive (e.g., 'Jumped to pitch too early without discovery', 'Missed opportunity when prospect mentioned pain point')"
  ],
  
  "coachingFeedback": "2-3 sentences of actionable advice for the agent to improve on future calls. Be specific and encouraging.",
  
  "callDuration": "Estimate (e.g., '2-3 minutes', '5+ minutes')",
  
  "keyMoments": [
    {"timestamp": "Turn 3", "description": "Prospect expressed interest in automation"},
    {"timestamp": "Turn 7", "description": "Agent effectively handled 'not interested' objection"}
  ]
}

Be honest but constructive. Focus on specific, actionable feedback.
Return ONLY valid JSON, no markdown or explanations.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sales coach and call analyst. Provide detailed, actionable feedback to help SDRs improve their cold calling skills.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 1500,
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
      fullTranscript: transcript,
      toneAnalysis: analysis.toneAnalysis || {
        prospectTone: 'Unable to determine',
        agentTone: 'Unable to determine',
        overallSentiment: 'neutral',
      },
      whatWentWell: Array.isArray(analysis.whatWentWell) ? analysis.whatWentWell : [],
      whatWentWrong: Array.isArray(analysis.whatWentWrong) ? analysis.whatWentWrong : [],
      coachingFeedback: analysis.coachingFeedback || 'Keep practicing and stay conversational!',
      callDuration: analysis.callDuration || 'Unknown',
      keyMoments: Array.isArray(analysis.keyMoments) ? analysis.keyMoments : [],
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
      fullTranscript: transcript,
      toneAnalysis: {
        prospectTone: 'Unable to determine',
        agentTone: 'Unable to determine',
        overallSentiment: 'neutral',
      },
      whatWentWell: [],
      whatWentWrong: [],
      coachingFeedback: 'Analysis was unavailable - try again.',
      callDuration: 'Unknown',
      keyMoments: [],
    }
  }
}
