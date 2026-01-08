import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/roleplay/[sessionId] - Fetch session details
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;

        const session = await prisma.roleplaySession.findUnique({
            where: { id: sessionId },
            include: { scenario: true }
        });

        if (!session) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            session: {
                id: session.id,
                transcript: session.transcript,
                score: session.score,
                feedback: session.feedback,
                scenario: session.scenario ? {
                    title: session.scenario.title,
                    description: session.scenario.description,
                    personaName: session.scenario.personaName,
                    personaRole: session.scenario.personaRole,
                    objectives: session.scenario.objectives,
                    difficulty: session.scenario.difficulty
                } : null
            }
        });
    } catch (error: any) {
        console.error('Roleplay Session GET Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch session' },
            { status: 500 }
        );
    }
}
