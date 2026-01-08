'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ArrowLeft,
    Clock,
    Copy,
    Check,
    ChevronDown,
    ChevronUp,
    Presentation,
    Search,
    MessageSquare,
    Target,
    Shield,
    CheckCircle
} from 'lucide-react';
import { PITCH_DURATIONS, SALES_STAGES } from '@/lib/learning/constants';

// Mock pitch data - will be replaced with API call
const MOCK_PITCH = {
    id: '1',
    title: 'Enterprise IT Transformation',
    duration: '10min',
    salesStage: 'INTRO',
    targetPersona: 'AE',
    opening: {
        short: "Hi, I'm [Name] from Atomicwork. We help enterprises modernize their IT service delivery with AI-native automation.",
        expanded: `Hi, I'm [Name] from Atomicwork. Thank you for taking the time today.

Before we dive in, I'd love to understand: what's driving your exploration of new service management solutions right now?

[PAUSE FOR RESPONSE]

That resonates with what we're hearing across the industry. Legacy ITSM tools weren't designed for today's employee expectations - they expect consumer-grade experiences at work.

Atomicwork was purpose-built to solve this. We're an AI-native enterprise service management platform that:
1. Automates 60%+ of routine requests with conversational AI
2. Unifies IT, HR, and Finance support on a single platform
3. Deploys in weeks, not months

Let me show you how this works in practice...`
    },
    discovery: {
        questions: [
            "What's your current ticket volume per month?",
            "How long does a typical resolution take today?",
            "Which teams (IT, HR, Finance) handle the most requests?",
            "What tools are you using currently for service management?",
            "What's driving the timing of this evaluation?"
        ],
        flow: "Start with pain → quantify impact → understand buying process → identify stakeholders"
    },
    narrative: {
        core: `Atomicwork represents a new category of enterprise service management - AI-native from day one, not AI bolted onto legacy architecture.

Our thesis is simple: The way employees get help at work is fundamentally broken. They're forced to navigate complex portals, wait for ticket assignments, and follow up repeatedly. Meanwhile, IT teams are drowning in repetitive requests they can't automate with legacy tools.

We've reimagined this from the ground up:

**1. Conversational AI First**
Employees interact through Slack, Teams, or a modern portal. Our AI understands intent, retrieves knowledge, and resolves 60%+ of requests automatically.

**2. Unified Platform**
IT, HR, and Finance share a common backbone. No more tool sprawl, no more inconsistent employee experiences.

**3. Modern Architecture**
We deploy in weeks via SaaS. No consultants, no customization projects, no upgrade anxiety.`,
        proofPoints: [
            "Reduced MTTR by 45% for a 5,000-employee technology company",
            "Automated 65% of IT tickets within 90 days of deployment",
            "Achieved 4.8/5 employee satisfaction score vs. 3.2 with legacy tool"
        ]
    },
    objectionHandling: {
        common: [
            {
                objection: "We've invested heavily in ServiceNow",
                response: "I completely understand. Many of our customers came from ServiceNow. The question isn't about your investment - it's about opportunity cost. If your team spends 40% of their time on manual ticket routing and repetitive tasks, that's time not spent on strategic work. We often see customers start with a specific workflow - say, employee onboarding - to prove value before expanding."
            },
            {
                objection: "AI makes me nervous - what about accuracy?",
                response: "That's a very valid concern. Our approach is 'AI with guardrails.' The AI handles routine requests where accuracy is 95%+, but anything complex or sensitive is automatically escalated to a human. You stay in control - you define what the AI can and cannot do. Would you like to see how our confidence thresholds work?"
            },
            {
                objection: "We need something that integrates with our existing stack",
                response: "Absolutely critical. We have 150+ pre-built integrations including Active Directory, Okta, Workday, and all major cloud providers. For anything custom, our API is comprehensive. What specific integrations are must-haves for you?"
            }
        ]
    },
    closing: {
        short: "Based on what we discussed, I'd recommend a structured 30-day pilot focused on [SPECIFIC USE CASE]. Can we schedule a technical session next week to define scope?",
        expanded: `To summarize what we've covered:

1. You're experiencing [PAIN POINT] which is costing approximately [QUANTIFIED IMPACT]
2. Atomicwork addresses this through [KEY CAPABILITIES]
3. We've demonstrated this with customers like [PROOF POINT]

Here's what I'd recommend as next steps:

**Short-term (This week):**
- I'll send you a custom ROI analysis based on your numbers
- Let's schedule a technical deep-dive with your IT architect

**Medium-term (Next 2-3 weeks):**
- 30-day pilot focused on [HIGHEST-IMPACT USE CASE]
- Weekly check-ins to measure results

Does this approach work for you? Who else should we include in the technical session?`
    }
};

type SectionKey = 'opening' | 'discovery' | 'narrative' | 'objectionHandling' | 'closing';

const SECTION_INFO: Record<SectionKey, { icon: React.ElementType; label: string; color: string }> = {
    opening: { icon: Presentation, label: 'Opening', color: 'text-blue-600' },
    discovery: { icon: Search, label: 'Discovery', color: 'text-purple-600' },
    narrative: { icon: MessageSquare, label: 'Narrative', color: 'text-green-600' },
    objectionHandling: { icon: Shield, label: 'Objection Handling', color: 'text-amber-600' },
    closing: { icon: CheckCircle, label: 'Closing', color: 'text-red-600' }
};

export default function PitchDetailPage() {
    const router = useRouter();
    const params = useParams();
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const pitch = MOCK_PITCH; // TODO: Fetch by id

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const copyToClipboard = async (text: string, fieldId: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const CopyButton = ({ text, fieldId }: { text: string; fieldId: string }) => (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(text, fieldId)}
            className="h-8 px-2"
        >
            {copiedField === fieldId ? (
                <Check className="h-4 w-4 text-green-600" />
            ) : (
                <Copy className="h-4 w-4" />
            )}
        </Button>
    );

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">{pitch.title}</h1>
                    <div className="flex gap-2 mt-2">
                        <Badge className="bg-blue-100 text-blue-700">
                            <Clock className="h-3 w-3 mr-1" />
                            {PITCH_DURATIONS[pitch.duration as keyof typeof PITCH_DURATIONS]?.label}
                        </Badge>
                        <Badge variant="outline">
                            {SALES_STAGES[pitch.salesStage as keyof typeof SALES_STAGES]?.label}
                        </Badge>
                        <Badge variant="secondary">{pitch.targetPersona}</Badge>
                    </div>
                </div>
            </div>

            {/* Content Sections */}
            <div className="space-y-4">
                {/* Opening */}
                <Card>
                    <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleSection('opening')}>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Presentation className="h-5 w-5 text-blue-600" />
                                Opening
                            </CardTitle>
                            {expandedSections.opening ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="short">
                            <div className="flex items-center justify-between mb-4">
                                <TabsList>
                                    <TabsTrigger value="short">Quick Version</TabsTrigger>
                                    <TabsTrigger value="expanded">Full Version</TabsTrigger>
                                </TabsList>
                            </div>
                            <TabsContent value="short" className="relative">
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="text-sm whitespace-pre-wrap">{pitch.opening.short}</p>
                                </div>
                                <div className="absolute top-2 right-2">
                                    <CopyButton text={pitch.opening.short} fieldId="opening-short" />
                                </div>
                            </TabsContent>
                            <TabsContent value="expanded" className="relative">
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="text-sm whitespace-pre-wrap">{pitch.opening.expanded}</p>
                                </div>
                                <div className="absolute top-2 right-2">
                                    <CopyButton text={pitch.opening.expanded} fieldId="opening-expanded" />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Discovery */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Search className="h-5 w-5 text-purple-600" />
                            Discovery Questions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {pitch.discovery.questions.map((q, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-medium flex items-center justify-center">
                                        {i + 1}
                                    </span>
                                    <p className="text-sm flex-1">{q}</p>
                                    <CopyButton text={q} fieldId={`discovery-${i}`} />
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 p-3 border rounded-lg bg-purple-50">
                            <p className="text-sm font-medium text-purple-700">Flow Guidance:</p>
                            <p className="text-sm text-purple-600">{pitch.discovery.flow}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Narrative */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-green-600" />
                            Core Narrative
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-muted rounded-lg mb-4 relative">
                            <p className="text-sm whitespace-pre-wrap">{pitch.narrative.core}</p>
                            <div className="absolute top-2 right-2">
                                <CopyButton text={pitch.narrative.core} fieldId="narrative" />
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium mb-2">Proof Points:</p>
                            <div className="space-y-2">
                                {pitch.narrative.proofPoints.map((pp, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2 bg-green-50 rounded text-sm">
                                        <Target className="h-4 w-4 text-green-600 flex-shrink-0" />
                                        <span className="flex-1">{pp}</span>
                                        <CopyButton text={pp} fieldId={`proof-${i}`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Objection Handling */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5 text-amber-600" />
                            Objection Handling
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {pitch.objectionHandling.common.map((item, i) => (
                                <div key={i} className="border rounded-lg overflow-hidden">
                                    <div className="p-3 bg-red-50 border-b">
                                        <p className="text-sm font-medium text-red-700">
                                            ❌ "{item.objection}"
                                        </p>
                                    </div>
                                    <div className="p-3 bg-green-50 relative">
                                        <p className="text-sm text-green-700">
                                            ✅ {item.response}
                                        </p>
                                        <div className="absolute top-2 right-2">
                                            <CopyButton text={item.response} fieldId={`objection-${i}`} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Closing */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-red-600" />
                            Closing
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="short">
                            <div className="flex items-center justify-between mb-4">
                                <TabsList>
                                    <TabsTrigger value="short">Quick Close</TabsTrigger>
                                    <TabsTrigger value="expanded">Full Summary</TabsTrigger>
                                </TabsList>
                            </div>
                            <TabsContent value="short" className="relative">
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="text-sm whitespace-pre-wrap">{pitch.closing.short}</p>
                                </div>
                                <div className="absolute top-2 right-2">
                                    <CopyButton text={pitch.closing.short} fieldId="closing-short" />
                                </div>
                            </TabsContent>
                            <TabsContent value="expanded" className="relative">
                                <div className="p-4 bg-muted rounded-lg">
                                    <p className="text-sm whitespace-pre-wrap">{pitch.closing.expanded}</p>
                                </div>
                                <div className="absolute top-2 right-2">
                                    <CopyButton text={pitch.closing.expanded} fieldId="closing-expanded" />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
