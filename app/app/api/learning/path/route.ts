
import { NextRequest, NextResponse } from 'next/server';
import { seedLearningPaths, getLearningPaths } from '@/lib/learning-service';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');

    if (!userId) {
        return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    try {
        if (action === 'seed') {
            await seedLearningPaths(userId);
            return NextResponse.json({ success: true, message: 'Seeded' });
        }

        const paths = await getLearningPaths(userId);
        return NextResponse.json({ paths });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal Error' }, { status: 500 });
    }
}
