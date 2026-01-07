
import { NextRequest, NextResponse } from 'next/server';
import { updateModuleProgress } from '@/lib/learning-service';

export async function POST(req: NextRequest) {
    try {
        const { userId, moduleId, status } = await req.json();

        if (!userId || !moduleId || !status) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const progress = await updateModuleProgress(userId, moduleId, status);
        return NextResponse.json({ success: true, progress });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
