
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startRoleplaySession, chatInRoleplay, endRoleplaySession } from '@/lib/roleplay-service';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, userId, scenarioId, sessionId, message } = body;

        if (action === 'start') {
            const session = await startRoleplaySession(userId, scenarioId);
            return NextResponse.json({ success: true, session });
        }

        if (action === 'chat') {
            const result = await chatInRoleplay(sessionId, message);
            return NextResponse.json({ success: true, ...result });
        }

        if (action === 'end') {
            const result = await endRoleplaySession(sessionId);
            return NextResponse.json({ success: true, result });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error("Roleplay API Error:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
