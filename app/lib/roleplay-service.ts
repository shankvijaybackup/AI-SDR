
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from "./prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ChatMessage {
    role: "user" | "model";
    parts: string;
}

export async function startRoleplaySession(userId: string, scenarioId: string) {
    return await prisma.roleplaySession.create({
        data: {
            userId,
            scenarioId,
            transcript: [],
            score: 0
        },
        include: { scenario: true }
    });
}

export async function chatInRoleplay(sessionId: string, message: string) {
    try {
        // 1. Fetch Session & Scenario
        const session = await prisma.roleplaySession.findUnique({
            where: { id: sessionId },
            include: { scenario: true }
        });

        if (!session || !session.scenario) {
            throw new Error("Session or Scenario not found");
        }

        const scenario = session.scenario;

        // 2. Construct System Prompt (The Persona)
        const systemPrompt = `You are roleplaying as ${scenario.personaName}, a ${scenario.personaRole}.
Your goal is to simulate a realistic sales conversation based on the following scenario:
"${scenario.description}"

Objectives for the Sales Rep (User):
${scenario.objectives.join('\n')}

INSTRUCTIONS:
- Stay in character at all times.
- Be realistic: challenge the user if they are vague, but be open if they make good points.
- Do not be easily convinced.
- Keep responses concise (simulating a spoken conversation or chat).
- Do not break character or give advice during the chat.`;

        // 3. Prepare History — map stored transcript to Claude messages array
        const currentTranscript = (session.transcript as any[]) || [];

        const messages: Anthropic.MessageParam[] = currentTranscript.map((t: any) => ({
            role: t.role === 'user' ? 'user' : 'assistant',
            content: t.content,
        }));

        // Add new user message
        messages.push({ role: 'user', content: message });

        // 4. Generate Response
        const result = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            temperature: 0.8,
            system: systemPrompt,
            messages,
        });

        const textBlock = result.content.find((b) => b.type === 'text')
        const responseText = (textBlock as { type: 'text'; text: string } | undefined)?.text || '';

        // 5. Update DB
        const updatedTranscript = [
            ...currentTranscript,
            { role: 'user', content: message },
            { role: 'model', content: responseText },
        ];

        await prisma.roleplaySession.update({
            where: { id: sessionId },
            data: { transcript: updatedTranscript }
        });

        return { response: responseText, transcript: updatedTranscript };

    } catch (error) {
        console.error("Roleplay Chat Error:", error);
        throw error;
    }
}

export async function endRoleplaySession(sessionId: string) {
    const session = await prisma.roleplaySession.findUnique({
        where: { id: sessionId },
        include: { scenario: true }
    });

    if (!session) throw new Error("Session not found");

    const transcriptText = (session.transcript as any[]).map(t => `${t.role}: ${t.content}`).join('\n');

    const scorePrompt = `Analyze this sales call transcript between a Sales Rep and ${session.scenario.personaName} (${session.scenario.personaRole}).

Objectives:
${session.scenario.objectives.join('\n')}

Task:
1. Score the rep from 0-100 based on how well they met the objectives and handled the persona.
2. Provide brief feedback (What went well, What to improve).

Return ONLY valid JSON:
{
  "score": number,
  "feedback": "string (markdown allowed)"
}

TRANSCRIPT:
${transcriptText}`;

    const result = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        temperature: 0.3,
        messages: [{ role: 'user', content: scorePrompt }],
    });

    const textBlock2 = result.content.find((b) => b.type === 'text')
    const responseText = (textBlock2 as { type: 'text'; text: string } | undefined)?.text || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 50, feedback: "Could not parse feedback." };

    await prisma.roleplaySession.update({
        where: { id: sessionId },
        data: {
            score: data.score,
            feedback: data.feedback,
            duration: 0
        }
    });

    return data;
}
