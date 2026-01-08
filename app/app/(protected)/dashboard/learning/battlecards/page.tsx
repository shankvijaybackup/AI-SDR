'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { Swords, Search, ArrowRight, Building2, TrendingUp, TrendingDown } from 'lucide-react';

// Mock battlecard data
const MOCK_BATTLECARDS = [
    {
        id: 'servicenow',
        competitorName: 'ServiceNow',
        overview: 'Enterprise ITSM incumbent with deep customization but complex implementation.',
        strengths: ['Enterprise scale', 'Deep customization', 'Broad ecosystem'],
        weaknesses: ['Slow deployment', 'Expensive', 'Poor UX'],
        marketPosition: 'Leader'
    },
    {
        id: 'jira-sm',
        competitorName: 'Jira Service Management',
        overview: 'Developer-focused ITSM with strong Atlassian integration.',
        strengths: ['Developer familiarity', 'Atlassian ecosystem', 'Lower cost'],
        weaknesses: ['Limited ITSM depth', 'Weak AI capabilities', 'Scaling challenges'],
        marketPosition: 'Challenger'
    },
    {
        id: 'freshservice',
        competitorName: 'Freshservice',
        overview: 'SMB-focused ITSM with good UX but limited enterprise features.',
        strengths: ['Easy to use', 'Quick deployment', 'Good value'],
        weaknesses: ['Limited enterprise features', 'Basic AI', 'Scaling concerns'],
        marketPosition: 'Niche'
    },
    {
        id: 'zendesk',
        competitorName: 'Zendesk',
        overview: 'Customer service leader expanding into employee service.',
        strengths: ['Great UX', 'Omnichannel', 'Fast deployment'],
        weaknesses: ['Not built for ITSM', 'Limited ITIL compliance', 'Security concerns'],
        marketPosition: 'Challenger'
    }
];

const POSITION_COLORS: Record<string, string> = {
    'Leader': 'bg-red-100 text-red-700',
    'Challenger': 'bg-amber-100 text-amber-700',
    'Niche': 'bg-blue-100 text-blue-700',
    'Visionary': 'bg-green-100 text-green-700'
};

export default function BattlecardsPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCards = MOCK_BATTLECARDS.filter(card =>
        card.competitorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.overview.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Swords className="h-8 w-8 text-red-600" />
                        Battlecards
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Win against competitors with tactical, not generic, guidance
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search competitors..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Battlecard Grid */}
            <div className="grid gap-4 md:grid-cols-2">
                {filteredCards.map((card) => (
                    <Card
                        key={card.id}
                        className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                    >
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                                        <Building2 className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">{card.competitorName}</CardTitle>
                                        <Badge className={POSITION_COLORS[card.marketPosition] || 'bg-gray-100'}>
                                            {card.marketPosition}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                {card.overview}
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {/* Their Strengths */}
                                <div>
                                    <p className="text-xs font-medium text-red-600 mb-2 flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" />
                                        Their Strengths
                                    </p>
                                    <ul className="text-xs text-muted-foreground space-y-1">
                                        {card.strengths.slice(0, 3).map((s, i) => (
                                            <li key={i}>• {s}</li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Their Weaknesses */}
                                <div>
                                    <p className="text-xs font-medium text-green-600 mb-2 flex items-center gap-1">
                                        <TrendingDown className="h-3 w-3" />
                                        Their Weaknesses
                                    </p>
                                    <ul className="text-xs text-muted-foreground space-y-1">
                                        {card.weaknesses.slice(0, 3).map((w, i) => (
                                            <li key={i}>• {w}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <Link href={`/dashboard/learning/battlecards/${card.id}`}>
                                <Button
                                    variant="ghost"
                                    className="w-full group-hover:bg-red-50 group-hover:text-red-600 transition-colors"
                                >
                                    View Full Battlecard
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredCards.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No battlecards found matching your search.</p>
                </div>
            )}
        </div>
    );
}
