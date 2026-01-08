
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./prisma";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export interface ChatMessage {
    role: "user" | "model";
    parts?: string;
    content?: string; // Frontend might send 'content' instead of 'parts'
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

        // 3. Build source reference map for clean citations
        const sourceMap = sources.map((s, i) => ({ num: i + 1, title: s.title, type: s.type }));
        const sourceRefText = sourceMap.map(s => `[${s.num}] "${s.title}"`).join(', ');

        // 4. Construct System Prompt
        const systemPrompt = `
You are the "Deep Tutor", an intelligent AI sales enablement coach.
Your goal is to answer the user's questions based ONLY on the provided context.
If the answer is not in the context, say "I don't have enough information in the provided documents to answer that."

CONTEXT:
${contextText}

AVAILABLE SOURCES: ${sourceRefText}

INSTRUCTIONS:
- Be concise and actionable.
- When referencing information from a document, use superscript-style numbered citations like [1], [2] etc.
- DO NOT include raw filenames or parentheses like "(filename.pdf)" in your response.
- At the END of your response, add a "---" divider followed by a brief "📚 Sources" section listing only the sources you actually referenced.
- If the user asks for a roleplay or quiz, suggest they use the specific features for that, but you can provide a quick example.
- Format your response in Markdown.

EXAMPLE FORMAT:
Your answer here with citations [1]. More info [2].

---
📚 **Sources**: [1] Document Title, [2] Another Document
`;

        // 5. Start Chat (Stateless for this service wrapper, but using history from frontend)
        // We construct the full prompt history for the generative model
        // Note: Google's SDK 'startChat' is stateful, but for a REST API we often rebuild state or use 'generateContent' with history string.
        // Let's use 'startChat' by mapping history.

        // Handle both 'parts' and 'content' fields from frontend, filter out empty/invalid messages
        console.log('[DeepTutor] Raw history received:', JSON.stringify(history));

        const geminiHistory = history
            .filter(h => {
                const text = h.parts || h.content;
                return text && typeof text === 'string' && text.trim().length > 0;
            })
            .map(h => {
                const textContent = String(h.parts || h.content || '').trim();
                console.log(`[DeepTutor] Mapping message - role: ${h.role}, text: ${textContent.substring(0, 50)}...`);
                return {
                    role: h.role as 'user' | 'model',
                    parts: [{ text: textContent }]
                };
            });

        console.log('[DeepTutor] Processed history count:', geminiHistory.length);

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

    } catch (error: unknown) {
        const err = error as { message?: string; status?: number };
        console.error("[DeepTutor] Error:", err);

        // Handle Quota Exceeded (429)
        if (err.message?.includes('429') || err.status === 429) {
            return "⚠️ **AI Service Busy (Quota Exceeded)**\n\nThe AI service is currently experiencing high demand or has hit a free tier limit. Please wait a minute and try again.\n\n*(Admin: Check Gemini API Quotas)*";
        }

        // Handle Overloaded (503)
        if (err.message?.includes('503') || err.status === 503) {
            return "⚠️ **AI Service Overloaded**\n\nThe AI is temporarily unavailable. Please try again in 30 seconds.";
        }

        throw err;
    }
}
