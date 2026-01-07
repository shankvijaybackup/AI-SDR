
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./prisma";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

export interface ChatMessage {
    role: "user" | "model";
    parts: string;
}

export async function chatWithKnowledge(
    userId: string,
    message: string,
    sourceIds: string[],
    history: ChatMessage[] = []
) {
    try {
        console.log(`[DeepTutor] Starting chat for User ${userId} with ${sourceIds.length} sources.`);

        // 1. Fetch Context (Document Content)
        // For MVP, we fetch the full text of selected documents. 
        // In production, we would use embeddings/RAG to fetch only relevant chunks.
        const sources = await prisma.knowledgeSource.findMany({
            where: {
                id: { in: sourceIds },
                // Ensure user has access (basic check, can be refined for company sharing)
                // OR: userId: userId (but we also want shared docs)
            },
            select: {
                title: true,
                content: true,
                type: true
            }
        });

        if (sources.length === 0) {
            throw new Error("No valid knowledge sources found.");
        }

        // 2. Prepare Context String
        // Truncate if too long (Gemini 1.5 Pro/Flash has huge context, but good update practice)
        let contextText = "";
        sources.forEach(source => {
            contextText += `\n--- SOURCE: ${source.title} (${source.type}) ---\n${source.content}\n`;
        });

        // 3. Construct System Prompt
        const systemPrompt = `
You are the "Deep Tutor", an intelligent AI sales enablement coach.
Your goal is to answer the user's questions based ONLY on the provided context.
If the answer is not in the context, say "I don't have enough information in the provided documents to answer that."

CONTEXT:
${contextText}

INSTRUCTIONS:
- Be concise and actionable.
- Cite the source title if you are referencing a specific document.
- If the user asks for a roleplay or quiz, suggest they use the specific features for that, but you can provide a quick example.
- Format your response in Markdown.
`;

        // 4. Start Chat (Stateless for this service wrapper, but using history from frontend)
        // We construct the full prompt history for the generative model
        // Note: Google's SDK 'startChat' is stateful, but for a REST API we often rebuild state or use 'generateContent' with history string.
        // Let's use 'startChat' by mapping history.

        const geminiHistory = history.map(h => ({
            role: h.role,
            parts: [{ text: h.parts }]
        }));

        // Inject system prompt into the first message or use systemInstruction if supported (Gemini 1.5)
        // For broad compatibility, we'll prepend context to the latest message or system instruction.
        // Let's use systemInstruction if strictly using 1.5, but 'gemini-pro' might vary.
        // Safest approach for "Chat": Prepend context to the first prompt or a distinct system message.

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}` }]
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I am ready to act as the Deep Tutor based on the provided context." }]
                },
                ...geminiHistory
            ],
            generationConfig: {
                maxOutputTokens: 1000,
            }
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();

        return response;

    } catch (error) {
        console.error("[DeepTutor] Error:", error);
        throw error;
    }
}
