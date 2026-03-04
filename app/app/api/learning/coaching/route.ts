import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/claude';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { COACHING_METRICS, BUYER_PERSONAS } from '@/lib/learning/constants';

export const dynamic = 'force-dynamic';

interface CoachingRequest {
    userResponse: string;
    buyerPersona: string;
    scenario: 'discovery' | 'demo' | 'objection' | 'closing';
    context?: string;
}

interface CoachingScore {
    clarity: number;
    structure: number;
    valueArticulation: number;
    overall: number;
}

interface CoachingFeedback {
    scores: CoachingScore;
    strengths: string[];
    improvements: string[];
    suggestions: string[];
}

// POST /api/learning/coaching - Get AI coaching feedback on a response
export async function POST(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body: CoachingRequest = await request.json();
        const { userResponse, buyerPersona, scenario, context } = body;

        if (!userResponse || !buyerPersona || !scenario) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const persona = BUYER_PERSONAS.find(p => p.id === buyerPersona);
        const personaName = persona?.name || buyerPersona;

        const prompt = `You are an expert sales coach at Atomicwork, an AI-native enterprise service management platform.

Analyze the following sales response and provide coaching feedback.

**Context:**
- Buyer Persona: ${personaName}
- Scenario: ${scenario}
- Difficulty: ${persona?.difficulty || 'medium'}
${context ? `- Additional Context: ${context}` : ''}

**User's Response:**
"${userResponse}"

**Scoring Criteria:**
1. Clarity (0-100): How clear and understandable was the response?
2. Structure (0-100): Was there a logical flow and organization of points?
3. Value Articulation (0-100): Did they effectively communicate business value relevant to Atomicwork?

Return a JSON object with this exact structure:
{
  "scores": {
    "clarity": <0-100>,
    "structure": <0-100>,
    "valueArticulation": <0-100>,
    "overall": <weighted average>
  },
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<area for improvement 1>", "<area for improvement 2>"],
  "suggestions": ["<specific suggestion 1>", "<specific suggestion 2>"]
}

Be constructive but honest. Focus on actionable feedback.`;

        const feedback = await generateJSON<CoachingFeedback>(prompt, {
            model: 'haiku',
            maxTokens: 1024,
            temperature: 0.4,
        });

        // Calculate weighted overall if not provided
        if (!feedback.scores.overall) {
            feedback.scores.overall = Math.round(
                feedback.scores.clarity * COACHING_METRICS.clarity.weight +
                feedback.scores.structure * COACHING_METRICS.structure.weight +
                feedback.scores.valueArticulation * COACHING_METRICS.valueArticulation.weight
            );
        }

        return NextResponse.json({
            feedback,
            persona: personaName,
            scenario
        });
    } catch (error) {
        console.error('Error generating coaching feedback:', error);
        return NextResponse.json({
            error: 'Failed to generate coaching feedback'
        }, { status: 500 });
    }
}
