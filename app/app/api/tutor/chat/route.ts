
import { NextRequest, NextResponse } from 'next/server';
import { chatWithKnowledge } from '@/lib/rag-service';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, message, sourceIds, history } = body;

        if (!userId || !message) {
            return NextResponse.json({ error: 'userId and message are required' }, { status: 400 });
        }

        if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
            return NextResponse.json({ error: 'At least one knowledge source must be selected' }, { status: 400 });
        }

        const response = await chatWithKnowledge(userId, message, sourceIds, history || []);

        return NextResponse.json({ success: true, response });

    } catch (error: any) {
        console.error("Deep Tutor API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
