import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/learning/pitches - List all pitch templates
export async function GET(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const duration = searchParams.get('duration');
        const persona = searchParams.get('persona');
        const stage = searchParams.get('stage');

        const where: any = {};

        // Filter by company or global (null companyId)
        where.OR = [
            { companyId: user.companyId },
            { companyId: null }
        ];

        if (duration && duration !== 'all') {
            where.duration = duration;
        }
        if (persona && persona !== 'all') {
            where.targetPersona = persona;
        }
        if (stage && stage !== 'all') {
            where.salesStage = stage;
        }

        const pitches = await prisma.pitchTemplate.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ pitches });
    } catch (error) {
        console.error('Error fetching pitches:', error);
        return NextResponse.json({ error: 'Failed to fetch pitches' }, { status: 500 });
    }
}

// POST /api/learning/pitches - Create a new pitch template
export async function POST(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { title, duration, salesStage, targetPersona, opening, discovery, narrative, demo, objectionHandling, closing } = body;

        if (!title || !duration || !salesStage) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const pitch = await prisma.pitchTemplate.create({
            data: {
                companyId: user.companyId,
                title,
                duration,
                salesStage,
                targetPersona: targetPersona || 'AE',
                opening,
                discovery,
                narrative,
                demo,
                objectionHandling,
                closing
            }
        });

        return NextResponse.json({ pitch }, { status: 201 });
    } catch (error) {
        console.error('Error creating pitch:', error);
        return NextResponse.json({ error: 'Failed to create pitch' }, { status: 500 });
    }
}
