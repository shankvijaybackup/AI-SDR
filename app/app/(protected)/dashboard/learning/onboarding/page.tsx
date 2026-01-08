'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Map,
    Calendar,
    Target,
    CheckCircle,
    Circle,
    Clock,
    ChevronDown,
    ChevronUp,
    GraduationCap,
    Trophy
} from 'lucide-react';
import { ONBOARDING_PHASES } from '@/lib/learning/constants';

// Mock onboarding curriculum
const ONBOARDING_CURRICULUM = [
    // Week 1-4: Foundation
    {
        week: 1,
        phase: 'foundation',
        title: "Atomicwork Platform Fundamentals",
        topics: ["Platform architecture", "Core concepts", "Navigation & UX"],
        deliverables: ["Complete platform tour", "Pass platform basics quiz"],
        status: "completed",
        quizScore: 92
    },
    {
        week: 2,
        phase: 'foundation',
        title: "ICP & Buyer Personas",
        topics: ["Ideal customer profile", "Buyer personas", "Pain points"],
        deliverables: ["Create persona flash cards", "Role-play exercise"],
        status: "completed",
        quizScore: 88
    },
    {
        week: 3,
        phase: 'foundation',
        title: "Atomicwork Value Proposition",
        topics: ["Key differentiators", "ROI framework", "Case studies"],
        deliverables: ["Deliver 2-min pitch", "Pass value prop quiz"],
        status: "completed",
        quizScore: 85
    },
    {
        week: 4,
        phase: 'foundation',
        title: "10-Minute Pitch Certification",
        topics: ["Full pitch structure", "Storytelling", "Handling interruptions"],
        deliverables: ["Deliver 10-min pitch to manager", "Get certified"],
        status: "in_progress",
        quizScore: null
    },
    // Week 5-8: Mastery
    {
        week: 5,
        phase: 'mastery',
        title: "Discovery Methodology",
        topics: ["MEDDIC framework", "Pain discovery", "Stakeholder mapping"],
        deliverables: ["Complete 3 discovery roleplays", "Pass discovery quiz"],
        status: "pending",
        quizScore: null
    },
    {
        week: 6,
        phase: 'mastery',
        title: "Demo Excellence",
        topics: ["Demo environment", "Use case demos", "Technical deep-dives"],
        deliverables: ["Deliver full demo", "Get demo certified"],
        status: "pending",
        quizScore: null
    },
    {
        week: 7,
        phase: 'mastery',
        title: "Competitive Intelligence",
        topics: ["ServiceNow", "Jira SM", "Freshservice"],
        deliverables: ["Complete battlecard training", "Win against competition roleplay"],
        status: "pending",
        quizScore: null
    },
    {
        week: 8,
        phase: 'mastery',
        title: "Objection Handling Mastery",
        topics: ["Pricing objections", "Technical concerns", "Change management"],
        deliverables: ["Handle 5 objection scenarios", "Pass objection quiz"],
        status: "pending",
        quizScore: null
    },
    // Week 9-12: Execution
    {
        week: 9,
        phase: 'execution',
        title: "Deal Execution Fundamentals",
        topics: ["Sales process", "Proposal creation", "Contract negotiation"],
        deliverables: ["Shadow 2 deal cycles", "Create practice proposal"],
        status: "pending",
        quizScore: null
    },
    {
        week: 10,
        phase: 'execution',
        title: "Advanced Scenarios",
        topics: ["Multi-stakeholder deals", "Large enterprise", "Competitive displacement"],
        deliverables: ["Complete advanced roleplay", "Scenario certification"],
        status: "pending",
        quizScore: null
    },
    {
        week: 11,
        phase: 'execution',
        title: "Partner Motion",
        topics: ["Partner program", "Co-sell strategies", "Referral programs"],
        deliverables: ["Partner pitch practice", "Partner motion quiz"],
        status: "pending",
        quizScore: null
    },
    {
        week: 12,
        phase: 'execution',
        title: "Final Certification",
        topics: ["Comprehensive review", "Final assessment", "Readiness score"],
        deliverables: ["Pass final certification exam", "Manager sign-off"],
        status: "pending",
        quizScore: null
    }
];

const STATUS_ICONS = {
    completed: CheckCircle,
    in_progress: Clock,
    pending: Circle
};

const STATUS_COLORS = {
    completed: 'text-green-600 bg-green-100',
    in_progress: 'text-blue-600 bg-blue-100',
    pending: 'text-gray-400 bg-gray-100'
};

export default function OnboardingPage() {
    const [expandedWeek, setExpandedWeek] = useState<number | null>(4);

    const completedWeeks = ONBOARDING_CURRICULUM.filter(w => w.status === 'completed').length;
    const totalWeeks = ONBOARDING_CURRICULUM.length;
    const progressPercent = Math.round((completedWeeks / totalWeeks) * 100);

    const currentPhase = ONBOARDING_CURRICULUM.find(w => w.status === 'in_progress')?.phase || 'foundation';
    const phaseInfo = ONBOARDING_PHASES[currentPhase as keyof typeof ONBOARDING_PHASES];

    const getWeeksByPhase = (phase: string) =>
        ONBOARDING_CURRICULUM.filter(w => w.phase === phase);

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Map className="h-8 w-8 text-green-600" />
                        Onboarding Journey
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        30-60-90 day structured ramp with measurable milestones
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-muted-foreground">Readiness Score</p>
                    <p className="text-3xl font-bold text-green-600">{progressPercent}%</p>
                </div>
            </div>

            {/* Progress Overview */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-medium">Week {completedWeeks + 1} of {totalWeeks}</p>
                            <p className="text-xs text-muted-foreground">Currently in: {phaseInfo?.label} Phase</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-700">
                            <Calendar className="h-3 w-3 mr-1" />
                            Days {phaseInfo?.days}
                        </Badge>
                    </div>
                    <Progress value={progressPercent} className="h-3" />
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                        <span>Foundation</span>
                        <span>Mastery</span>
                        <span>Execution</span>
                    </div>
                </CardContent>
            </Card>

            {/* Phase Sections */}
            {(['foundation', 'mastery', 'execution'] as const).map((phase) => {
                const phaseData = ONBOARDING_PHASES[phase];
                const weeks = getWeeksByPhase(phase);
                const phaseCompleted = weeks.filter(w => w.status === 'completed').length;
                const isCurrentPhase = phase === currentPhase;

                return (
                    <div key={phase} className="space-y-3">
                        {/* Phase Header */}
                        <div className={`flex items-center justify-between p-4 rounded-lg ${isCurrentPhase ? 'bg-blue-50 border-2 border-blue-200' : 'bg-muted'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${phaseCompleted === weeks.length ? 'bg-green-100' :
                                        isCurrentPhase ? 'bg-blue-100' : 'bg-gray-100'
                                    }`}>
                                    {phaseCompleted === weeks.length ? (
                                        <Trophy className="h-5 w-5 text-green-600" />
                                    ) : (
                                        <Target className="h-5 w-5 text-blue-600" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold">{phaseData.label} Phase</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Days {phaseData.days} • {phaseData.focus}
                                    </p>
                                </div>
                            </div>
                            <Badge variant="outline">
                                {phaseCompleted}/{weeks.length} Complete
                            </Badge>
                        </div>

                        {/* Week Cards */}
                        <div className="grid gap-3 ml-4">
                            {weeks.map((week) => {
                                const StatusIcon = STATUS_ICONS[week.status as keyof typeof STATUS_ICONS];
                                const isExpanded = expandedWeek === week.week;

                                return (
                                    <Card
                                        key={week.week}
                                        className={`transition-all ${week.status === 'in_progress' ? 'border-blue-300 shadow-md' : ''}`}
                                    >
                                        <CardHeader
                                            className="pb-2 cursor-pointer"
                                            onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-full ${STATUS_COLORS[week.status as keyof typeof STATUS_COLORS]}`}>
                                                        <StatusIcon className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base">
                                                            Week {week.week}: {week.title}
                                                        </CardTitle>
                                                        <CardDescription className="text-xs">
                                                            {week.topics.join(' • ')}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {week.quizScore !== null && (
                                                        <Badge className={week.quizScore >= 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                                                            <GraduationCap className="h-3 w-3 mr-1" />
                                                            {week.quizScore}%
                                                        </Badge>
                                                    )}
                                                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                                </div>
                                            </div>
                                        </CardHeader>

                                        {isExpanded && (
                                            <CardContent className="pt-0">
                                                <div className="pl-11 space-y-4">
                                                    {/* Topics */}
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Topics</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {week.topics.map((topic, i) => (
                                                                <Badge key={i} variant="secondary" className="text-xs">
                                                                    {topic}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Deliverables */}
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Deliverables</p>
                                                        <div className="space-y-2">
                                                            {week.deliverables.map((del, i) => (
                                                                <div key={i} className="flex items-center gap-2">
                                                                    <Checkbox
                                                                        checked={week.status === 'completed'}
                                                                        disabled={week.status !== 'in_progress'}
                                                                    />
                                                                    <span className="text-sm">{del}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    {week.status === 'in_progress' && (
                                                        <div className="flex gap-2">
                                                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                                                Start Quiz
                                                            </Button>
                                                            <Button size="sm" variant="outline">
                                                                View Resources
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
