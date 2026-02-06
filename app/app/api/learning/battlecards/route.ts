import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/learning/battlecards - List all battlecards
export async function GET(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');

        const where: any = {
            OR: [
                { companyId: user.companyId },
                { companyId: null }
            ]
        };

        if (search) {
            where.AND = {
                OR: [
                    { competitorName: { contains: search, mode: 'insensitive' } },
                    { overview: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        const battlecards = await prisma.battlecard.findMany({
            where,
            orderBy: { competitorName: 'asc' }
        });

        return NextResponse.json({ battlecards });
    } catch (error) {
        console.error('Error fetching battlecards:', error);
        return NextResponse.json({ error: 'Failed to fetch battlecards' }, { status: 500 });
    }
}

// POST /api/learning/battlecards - Create a new battlecard
export async function POST(request: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            competitorName,
            overview,
            strengths,
            weaknesses,
            pricing,
            killPoints,
            whenTheyWin,
            whenWeWin,
            landmines,
            positioning,
            discoveryQuestions,
            whyChange,
            nextSteps
        } = body;

        if (!competitorName) {
            return NextResponse.json({ error: 'Competitor name is required' }, { status: 400 });
        }

        const battlecard = await prisma.battlecard.create({
            data: {
                companyId: user.companyId,
                competitorName,
                overview,
                strengths: strengths || [],
                weaknesses: weaknesses || [],
                pricing,
                killPoints: killPoints || [],
                whenTheyWin: whenTheyWin || [],
                whenWeWin: whenWeWin || [],
                landmines: landmines || [],
                positioning: positioning || [],
                discoveryQuestions: discoveryQuestions || [],
                whyChange,
                nextSteps: nextSteps || []
            }
        });

        return NextResponse.json({ battlecard }, { status: 201 });
    } catch (error) {
        console.error('Error creating battlecard:', error);
        return NextResponse.json({ error: 'Failed to create battlecard' }, { status: 500 });
    }
}
