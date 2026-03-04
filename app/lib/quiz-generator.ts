
import { generateJSON } from '@/lib/claude'
import { prisma } from "./prisma";

interface GenerateQuizOptions {
    sourceIds: string[];
    userId: string;
    count?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
}

export async function generateQuizFromSources({ sourceIds, userId, count = 5, difficulty = 'medium' }: GenerateQuizOptions) {
    try {
        // 1. Fetch all sources
        const sources = await prisma.knowledgeSource.findMany({
            where: {
                id: { in: sourceIds },
            },
            select: { title: true, content: true, summary: true }
        });

        if (sources.length === 0) {
            throw new Error("No valid knowledge sources found.");
        }

        // 2. Prepare Context
        let combinedContext = "";
        sources.forEach(source => {
            combinedContext += `--- DOCUMENT: ${source.title} ---\n`;
            combinedContext += source.content || source.summary || "";
            combinedContext += `\n\n`;
        });

        if (combinedContext.length > 100000) {
            combinedContext = combinedContext.substring(0, 100000) + "...[TRUNCATED]";
        }

        // 3. Generate quiz with Claude
        const prompt = `You are an expert Sales Enablement Tutor.
Your goal is to create a quiz that tests a sales representative's understanding of the provided knowledge base materials.

Instructions:
1. Generate ${count} multiple-choice questions based ONLY on the provided context.
2. Difficulty Level: ${difficulty.toUpperCase()}.
3. Focus on key sales concepts, product features, objection handling, and value propositions.
4. Output strictly in JSON format.

JSON Schema:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string (must be one of the options)",
      "explanation": "string (why this is correct)"
    }
  ]
}

CONTEXT:
${combinedContext}`;

        const data = await generateJSON<{ questions: any[] }>(prompt, {
            model: 'haiku',
            maxTokens: 2048,
            temperature: 0.4,
        });

        const questions = data.questions;

        if (!questions || !Array.isArray(questions)) {
            throw new Error("Invalid format from AI");
        }

        // 4. Save to DB
        const quizTitle = sources.length === 1
            ? `Quiz: ${sources[0].title}`
            : `Combined Quiz (${sources.length} sources)`;

        const quizDescription = `Generated from: ${sources.map(s => s.title).join(', ')}`;

        const quiz = await prisma.quiz.create({
            data: {
                userId,
                title: quizTitle,
                description: quizDescription,
                difficulty,
                sources: {
                    connect: sourceIds.map(id => ({ id }))
                },
                questions: {
                    create: questions.map((q: any) => ({
                        question: q.question,
                        type: 'multiple_choice',
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                        explanation: q.explanation
                    }))
                }
            },
            include: {
                questions: true
            }
        });

        return quiz;

    } catch (error) {
        console.error("Quiz Generation Error:", error);
        throw error;
    }
}
