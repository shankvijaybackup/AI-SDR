
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    // Auth check should be here
    // For now, fetch all or restrict by user if we can get it from header/session
    // Simplified: fetch all sources (multi-tenancy concern for later)

    try {
        const whereClause: any = { isActive: true };
        if (type) {
            whereClause.type = type;
        }

        const sources = await prisma.knowledgeSource.findMany({
            where: whereClause,
            select: { id: true, title: true, type: true, userId: true },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ sources });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch knowledge sources' }, { status: 500 });
    }
}
