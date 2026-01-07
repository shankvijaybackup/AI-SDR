
import { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Quizzes | AI-SDR',
    description: 'Practice quizzes.',
};

export default async function QuizListPage() {
    // Mock user for MVP if auth unimplemented, but try to get session
    // const session = await auth(); 
    // const userId = session?.user?.id;
    // Fallback to first user for dev
    const user = await prisma.user.findFirst();
    const userId = user?.id;

    const quizzes = userId ? await prisma.quiz.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { questions: true } } }
    }) : [];

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Your Quizzes</h2>
                <Link href="/dashboard/learning/quiz/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> New Quiz
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {quizzes.length === 0 && (
                    <div className="col-span-3 text-center text-muted-foreground p-10">
                        No quizzes found. Create one to get started!
                    </div>
                )}

                {quizzes.map((quiz) => (
                    <Card key={quiz.id} className="hover:bg-accent/50 transition-colors cursor-pointer">
                        <Link href={`/dashboard/learning/quiz/${quiz.id}`} className="block h-full">
                            <CardHeader>
                                <CardTitle className="text-lg">{quiz.title}</CardTitle>
                                <div className="text-sm text-muted-foreground">{quiz.description}</div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between text-sm">
                                    <span>{quiz._count.questions} Questions</span>
                                    <span className="capitalize px-2 py-0.5 bg-secondary rounded text-xs">{quiz.difficulty}</span>
                                </div>
                            </CardContent>
                        </Link>
                    </Card>
                ))}
            </div>
        </div>
    );
}
