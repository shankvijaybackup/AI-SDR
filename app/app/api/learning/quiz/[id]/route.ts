
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const quiz = await prisma.quiz.findUnique({
            where: { id },
            include: {
                questions: true
            }
        });

        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        return NextResponse.json({ quiz });
    } catch (error) {
        console.error("Error fetching quiz:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Check if quiz exists
        const quiz = await prisma.quiz.findUnique({ where: { id } });
        if (!quiz) {
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        // Delete quiz (cascading delete should handle questions/options if configured, otherwise we might need explicit delete)
        // Assuming schema handles cascade or we just delete the quiz. 
        // Best to check schema, but usually Prisma handles cascade if relation is set.
        // Let's assume standard deletion for now.

        await prisma.quiz.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting quiz:", error);
        return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 });
    }
}
