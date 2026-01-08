'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import Link from 'next/link';
import {
    Presentation,
    Clock,
    Filter,
    Search,
    Briefcase,
    Code,
    Users,
    ArrowRight
} from 'lucide-react';
import { PITCH_DURATIONS, SALES_STAGES, SALES_PERSONAS } from '@/lib/learning/constants';

// Mock data - will be replaced with API call
const MOCK_PITCHES = [
    {
        id: '1',
        title: 'Enterprise IT Transformation',
        duration: '10min',
        salesStage: 'INTRO',
        targetPersona: 'AE',
        description: 'Executive-level pitch focusing on digital transformation and modernizing IT service delivery.'
    },
    {
        id: '2',
        title: 'Technical Deep Dive',
        duration: '45min',
        salesStage: 'DEMO',
        targetPersona: 'SC',
        description: 'Full technical demonstration including architecture, integrations, and advanced workflows.'
    },
    {
        id: '3',
        title: 'Partner Value Proposition',
        duration: '30min',
        salesStage: 'DISCOVERY',
        targetPersona: 'PARTNER',
        description: 'Partner-focused pitch covering co-sell opportunities and implementation scope.'
    },
    {
        id: '4',
        title: 'Elevator Pitch',
        duration: '30sec',
        salesStage: 'INTRO',
        targetPersona: 'AE',
        description: 'Quick one-liner hook for networking events and brief introductions.'
    },
    {
        id: '5',
        title: 'Cold Call Script',
        duration: '2min',
        salesStage: 'INTRO',
        targetPersona: 'AE',
        description: 'Effective cold call opener with problem-solution-differentiator framework.'
    },
    {
        id: '6',
        title: 'Competitive Positioning',
        duration: '10min',
        salesStage: 'COMPETITION',
        targetPersona: 'AE',
        description: 'How to position against ServiceNow, Jira SM, and Freshservice.'
    }
];

const PERSONA_ICONS = {
    AE: Briefcase,
    SC: Code,
    PARTNER: Users
};

const DURATION_COLORS: Record<string, string> = {
    '30sec': 'bg-green-100 text-green-700',
    '2min': 'bg-blue-100 text-blue-700',
    '10min': 'bg-purple-100 text-purple-700',
    '30min': 'bg-amber-100 text-amber-700',
    '45min': 'bg-orange-100 text-orange-700',
    '90min': 'bg-red-100 text-red-700'
};

export default function PitchLibraryPage() {
    const [pitches, setPitches] = useState(MOCK_PITCHES);
    const [searchQuery, setSearchQuery] = useState('');
    const [durationFilter, setDurationFilter] = useState<string>('all');
    const [personaFilter, setPersonaFilter] = useState<string>('all');
    const [stageFilter, setStageFilter] = useState<string>('all');

    const filteredPitches = pitches.filter(pitch => {
        const matchesSearch = pitch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            pitch.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDuration = durationFilter === 'all' || pitch.duration === durationFilter;
        const matchesPersona = personaFilter === 'all' || pitch.targetPersona === personaFilter;
        const matchesStage = stageFilter === 'all' || pitch.salesStage === stageFilter;

        return matchesSearch && matchesDuration && matchesPersona && matchesStage;
    });

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Presentation className="h-8 w-8 text-blue-600" />
                        Pitch Library
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Ready-to-use talk tracks organized by duration, persona, and sales stage
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search pitches..."
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <Select value={durationFilter} onValueChange={setDurationFilter}>
                            <SelectTrigger className="w-[140px]">
                                <Clock className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Duration" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Durations</SelectItem>
                                {Object.entries(PITCH_DURATIONS).map(([key, value]) => (
                                    <SelectItem key={key} value={key}>{value.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={personaFilter} onValueChange={setPersonaFilter}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Persona" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Personas</SelectItem>
                                {Object.entries(SALES_PERSONAS).map(([key, value]) => (
                                    <SelectItem key={key} value={key}>{value.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={stageFilter} onValueChange={setStageFilter}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Stage" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Stages</SelectItem>
                                {Object.entries(SALES_STAGES).map(([key, value]) => (
                                    <SelectItem key={key} value={key}>{value.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Pitch Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPitches.map((pitch) => {
                    const PersonaIcon = PERSONA_ICONS[pitch.targetPersona as keyof typeof PERSONA_ICONS];
                    const durationInfo = PITCH_DURATIONS[pitch.duration as keyof typeof PITCH_DURATIONS];
                    const stageInfo = SALES_STAGES[pitch.salesStage as keyof typeof SALES_STAGES];

                    return (
                        <Card
                            key={pitch.id}
                            className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <Badge className={DURATION_COLORS[pitch.duration] || 'bg-gray-100'}>
                                        <Clock className="h-3 w-3 mr-1" />
                                        {durationInfo?.label || pitch.duration}
                                    </Badge>
                                    <Badge variant="outline" className="gap-1">
                                        {PersonaIcon && <PersonaIcon className="h-3 w-3" />}
                                        {pitch.targetPersona}
                                    </Badge>
                                </div>
                                <CardTitle className="mt-3 text-lg">{pitch.title}</CardTitle>
                                <CardDescription className="text-xs uppercase tracking-wide">
                                    {stageInfo?.label || pitch.salesStage}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                    {pitch.description}
                                </p>
                                <Link href={`/dashboard/learning/pitches/${pitch.id}`}>
                                    <Button
                                        variant="ghost"
                                        className="w-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"
                                    >
                                        View Pitch
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {filteredPitches.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <Presentation className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pitches found matching your filters.</p>
                    <Button
                        variant="link"
                        onClick={() => {
                            setSearchQuery('');
                            setDurationFilter('all');
                            setPersonaFilter('all');
                            setStageFilter('all');
                        }}
                    >
                        Clear all filters
                    </Button>
                </div>
            )}
        </div>
    );
}
