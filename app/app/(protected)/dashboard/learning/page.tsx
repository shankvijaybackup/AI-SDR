
import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookOpen, Brain, GraduationCap, Plus } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Learning Hub | AI-SDR',
    description: 'Manage your learning, quizzes, and research notebooks.',
};

export default async function LearningPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Learning Hub</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Knowledge Base Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Knowledge Base
                        </CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Files & Docs</div>
                        <p className="text-xs text-muted-foreground">
                            Upload documents for RAG and Quiz generation.
                        </p>
                        <div className="mt-4">
                            <Link href="/dashboard/knowledge">
                                <Button variant="outline" className="w-full">
                                    Manage Knowledge
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Quizzes Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Quizzes & Practice
                        </CardTitle>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Generate Quiz</div>
                        <p className="text-xs text-muted-foreground">
                            Test your knowledge from uploaded materials.
                        </p>
                        <div className="mt-4">
                            <Link href="/dashboard/learning/quiz">
                                <Button variant="outline" className="w-full">
                                    Go to Quizzes
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Notebooks Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Notebooks
                        </CardTitle>
                        <Brain className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Study Notes</div>
                        <p className="text-xs text-muted-foreground">
                            Organize research and insights.
                        </p>
                        <div className="mt-4">
                            <Link href="/dashboard/learning/notebook">
                                <Button variant="outline" className="w-full">
                                    Open Notebooks
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
