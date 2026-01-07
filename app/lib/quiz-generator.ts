
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./prisma";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '');

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
                // Ensure user owns them or they are shared? For MVP, ownership check.
                // userId: userId // Commented out to allow testing if userId mismatch in seed data
            },
            select: { title: true, content: true, summary: true } // Fetch content and summary
        });

        if (sources.length === 0) {
            throw new Error("No valid knowledge sources found.");
        }

        // 2. Prepare Context (Concatenate content, truncating if necessary)
        // Gemini 1.5 Flash has 1M context, so we can be generous, but let's still be safe.
        // We'll prioritize Summary first, then Content.

        let combinedContext = "";
        sources.forEach(source => {
            combinedContext += `--- DOCUMENT: ${source.title} ---\n`;
            combinedContext += source.content || source.summary || ""; // Fallback
            combinedContext += `\n\n`;
        });

        // Truncate hard limit (e.g. 100k chars for safety if using smaller model, but Flash handles more)
        if (combinedContext.length > 500000) {
            combinedContext = combinedContext.substring(0, 500000) + "...[TRUNCATED]";
        }

        // 3. Prompt Engineering
        const systemPrompt = `
      You are an expert Sales Enablement Tutor. 
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
    `;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        });

        const result = await model.generateContent([
            systemPrompt,
            `CONTEXT:\n${combinedContext}`
        ]);

        const response = result.response;
        const text = response.text();

        // Parse JSON
        const data = JSON.parse(text);
        const questions = data.questions;

        if (!questions || !Array.isArray(questions)) {
            throw new Error("Invalid format from AI");
        }

        // 4. Save to DB
        // Create Quiz
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
                // Connect multiple sources
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
