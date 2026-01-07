
import { NextRequest, NextResponse } from 'next/server';
import { generateQuizFromSources } from '@/lib/quiz-generator';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sourceId, sourceIds, userId, count, difficulty } = body;

        // Support both single sourceId (legacy/simple) and sourceIds array
        let finalSourceIds: string[] = [];
        if (sourceIds && Array.isArray(sourceIds)) {
            finalSourceIds = sourceIds;
        } else if (sourceId) {
            finalSourceIds = [sourceId];
        }

        if (finalSourceIds.length === 0) {
            return NextResponse.json({ error: 'At least one sourceId is required' }, { status: 400 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const quiz = await generateQuizFromSources({
            sourceIds: finalSourceIds,
            userId,
            count: count || 5,
            difficulty: difficulty || 'medium'
        });

        return NextResponse.json({ success: true, quiz });

    } catch (error: any) {
        console.error("Quiz API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    try {
        const quizzes = await prisma.quiz.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { questions: true } },
                sources: { select: { title: true } } // Include source titles
            }
        });

        return NextResponse.json({ quizzes });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch quizzes' }, { status: 500 });
    }
}
