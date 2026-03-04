
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
        const sources = await prisma.knowledgeSource.findMany({
            where: {
                id: { in: sourceIds },
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
        let contextText = "";
        sources.forEach(source => {
            contextText += `\n--- SOURCE: ${source.title} (${source.type}) ---\n${source.content}\n`;
        });

        // 3. Build source reference map for clean citations
        const sourceMap = sources.map((s, i) => ({ num: i + 1, title: s.title, type: s.type }));
        const sourceRefText = sourceMap.map(s => `[${s.num}] "${s.title}"`).join(', ');

        // 4. Construct System Prompt
        const systemPrompt = `You are the "Deep Tutor", an intelligent AI sales enablement coach.
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
📚 **Sources**: [1] Document Title, [2] Another Document`;

        // 5. Build Claude messages array from history
        console.log('[DeepTutor] Raw history received:', JSON.stringify(history));

        const messages: Anthropic.MessageParam[] = history
            .filter(h => {
                const text = h.parts || h.content;
                return text && typeof text === 'string' && (text as string).trim().length > 0;
            })
            .map(h => {
                const textContent = String(h.parts || h.content || '').trim();
                console.log(`[DeepTutor] Mapping message - role: ${h.role}, text: ${textContent.substring(0, 50)}...`);
                return {
                    role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                    content: textContent,
                };
            });

        // Add current user message
        messages.push({ role: 'user', content: message });

        console.log('[DeepTutor] Processed history count:', messages.length - 1);

        const result = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1000,
            system: systemPrompt,
            messages,
        });

        const response = result.content[0]?.text || '';
        return response;

    } catch (error: unknown) {
        const err = error as { message?: string; status?: number };
        console.error("[DeepTutor] Error:", err);

        if (err.status === 429) {
            return "⚠️ **AI Service Busy (Rate Limited)**\n\nThe AI service is currently experiencing high demand. Please wait a minute and try again.";
        }

        if (err.status === 503) {
            return "⚠️ **AI Service Overloaded**\n\nThe AI is temporarily unavailable. Please try again in 30 seconds.";
        }

        throw err;
    }
}
