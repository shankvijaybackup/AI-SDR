
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./prisma";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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
        const systemPrompt = `
You are roleplaying as ${scenario.personaName}, a ${scenario.personaRole}.
Your goal is to simulate a realistic sales conversation based on the following scenario:
"${scenario.description}"

Objectives for the Sales Rep (User):
${scenario.objectives.join('\n')}

INSTRUCTIONS:
- Stay in character at all times.
- Be realistic: challenge the user if they are vague, but be open if they make good points.
- Do not be easily convinced.
- Keep responses concise (simulating a spoken conversation or chat).
- Do not break character or give advice during the chat.
`;

        // 3. Prepare History
        // Cast the existing JSON transcript to a typed array
        const currentTranscript = (session.transcript as any[]) || [];

        // Append user message to transcript (local only first)
        const updatedTranscript = [...currentTranscript, { role: 'user', content: message }];

        // Map to Gemini History
        const geminiHistory = currentTranscript.map((t: any) => ({
            role: t.role === 'user' ? 'user' : 'model',
            parts: [{ text: t.content }]
        }));

        // 4. Generate Response
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}` }]
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I am in character." }]
                },
                ...geminiHistory
            ]
        });

        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        // 5. Update DB
        updatedTranscript.push({ role: 'model', content: responseText });

        await prisma.roleplaySession.update({
            where: { id: sessionId },
            data: {
                transcript: updatedTranscript,
                // We could run a parallel "Scorer" check here, but maybe defer to endSession
            }
        });

        return { response: responseText, transcript: updatedTranscript };

    } catch (error) {
        console.error("Roleplay Chat Error:", error);
        throw error;
    }
}

export async function endRoleplaySession(sessionId: string) {
    // Generate Scorecard
    const session = await prisma.roleplaySession.findUnique({
        where: { id: sessionId },
        include: { scenario: true }
    });

    if (!session) throw new Error("Session not found");

    const transcriptText = (session.transcript as any[]).map(t => `${t.role}: ${t.content}`).join('\n');

    const scorePrompt = `
Analyze this sales call transcript between a Sales Rep and ${session.scenario.personaName} (${session.scenario.personaRole}).

Objectives:
${session.scenario.objectives.join('\n')}

Task:
1. Score the rep from 0-100 based on how well they met the objectives and handled the persona.
2. Provide brief feedback (What went well, What to improve).

Output JSON:
{
  "score": number,
  "feedback": "string (markdown allowed)"
}

TRANSCRIPT:
${transcriptText}
`;

    const result = await model.generateContent(scorePrompt);
    const responseText = result.response.text();

    // Simple JSON parsing (add robustness in prod)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 50, feedback: "Could not parse feedback." };

    await prisma.roleplaySession.update({
        where: { id: sessionId },
        data: {
            score: data.score,
            feedback: data.feedback,
            duration: 0 // TODO: Calculate duration
        }
    });

    return data;
}
