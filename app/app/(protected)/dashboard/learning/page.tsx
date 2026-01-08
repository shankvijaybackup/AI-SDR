import { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
    BookOpen,
    Brain,
    GraduationCap,
    Presentation,
    Swords,
    Map,
    MessageSquare,
    Target
} from 'lucide-react';

export const metadata: Metadata = {
    title: 'Learning Hub | Atomicwork',
    description: 'Sales enablement platform for AEs, SCs, and Partners.',
};

const LEARNING_MODULES = [
    {
        title: "Pitch Library",
        subtitle: "Talk Tracks & Scripts",
        description: "Ready-to-use pitches organized by duration and persona.",
        href: "/dashboard/learning/pitches",
        icon: Presentation,
        color: "text-blue-600",
        bgColor: "bg-blue-50"
    },
    {
        title: "Battlecards",
        subtitle: "Competitive Intelligence",
        description: "Win against competitors with tactical, not generic, guidance.",
        href: "/dashboard/learning/battlecards",
        icon: Swords,
        color: "text-red-600",
        bgColor: "bg-red-50"
    },
    {
        title: "Onboarding Journey",
        subtitle: "30-60-90 Day Plan",
        description: "Structured ramp with measurable milestones.",
        href: "/dashboard/learning/onboarding",
        icon: Map,
        color: "text-green-600",
        bgColor: "bg-green-50"
    },
    {
        title: "Practice Mode",
        subtitle: "AI Roleplay",
        description: "Practice with AI-simulated buyers and get coaching feedback.",
        href: "/dashboard/learning/roleplay",
        icon: MessageSquare,
        color: "text-purple-600",
        bgColor: "bg-purple-50"
    },
    {
        title: "Quizzes",
        subtitle: "Knowledge Validation",
        description: "Test your understanding with AI-generated quizzes.",
        href: "/dashboard/learning/quiz",
        icon: GraduationCap,
        color: "text-amber-600",
        bgColor: "bg-amber-50"
    },
    {
        title: "Knowledge Base",
        subtitle: "Documents & Resources",
        description: "Upload and manage product documentation.",
        href: "/dashboard/knowledge",
        icon: BookOpen,
        color: "text-slate-600",
        bgColor: "bg-slate-50"
    }
];

export default async function LearningPage() {
    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Learning Hub</h1>
                    <p className="text-muted-foreground mt-1">
                        Sales enablement for Account Executives, Solutions Consultants, and Partners
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Readiness Score</p>
                        <p className="text-2xl font-bold text-green-600">72%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                        <Target className="h-6 w-6 text-white" />
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
                    <CardContent className="p-4">
                        <p className="text-blue-100 text-sm">Pitches Practiced</p>
                        <p className="text-2xl font-bold">12</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
                    <CardContent className="p-4">
                        <p className="text-purple-100 text-sm">Roleplay Sessions</p>
                        <p className="text-2xl font-bold">8</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-0">
                    <CardContent className="p-4">
                        <p className="text-amber-100 text-sm">Quiz Score</p>
                        <p className="text-2xl font-bold">85%</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
                    <CardContent className="p-4">
                        <p className="text-green-100 text-sm">Onboarding Progress</p>
                        <p className="text-2xl font-bold">Week 4</p>
                    </CardContent>
                </Card>
            </div>

            {/* Module Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {LEARNING_MODULES.map((module) => (
                    <Card
                        key={module.title}
                        className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer"
                    >
                        <Link href={module.href} className="block h-full">
                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                <div>
                                    <CardTitle className="text-lg font-semibold">
                                        {module.title}
                                    </CardTitle>
                                    <CardDescription className="text-xs uppercase tracking-wide">
                                        {module.subtitle}
                                    </CardDescription>
                                </div>
                                <div className={`p-2 rounded-lg ${module.bgColor}`}>
                                    <module.icon className={`h-5 w-5 ${module.color}`} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {module.description}
                                </p>
                                <Button
                                    variant="ghost"
                                    className="w-full group-hover:bg-muted transition-colors"
                                >
                                    Open →
                                </Button>
                            </CardContent>
                        </Link>
                    </Card>
                ))}
            </div>
        </div>
    );
}
