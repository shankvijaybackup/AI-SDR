'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ArrowLeft,
    Copy,
    Check,
    Swords,
    AlertTriangle,
    Target,
    Shield,
    Search,
    Navigation,
    ArrowRight,
    Building2
} from 'lucide-react';

// Mock detailed battlecard
const MOCK_BATTLECARD = {
    id: 'servicenow',
    competitorName: 'ServiceNow',
    overview: `ServiceNow is the 800-pound gorilla of enterprise ITSM. They dominate large enterprise accounts with deep customization capabilities and a broad platform that extends beyond IT into HR, Legal, and Security. However, their complexity is their Achilles heel.

**Key Facts:**
- Founded: 2004, publicly traded (NYSE: NOW)
- Revenue: $7B+ annually
- Sweet Spot: Fortune 500, 10,000+ employees
- Primary Buyer: CIO / VP of IT`,

    strengths: [
        "Enterprise scale and proven reliability",
        "Deep customization via low-code/no-code",
        "Broad platform (IT, HR, Security, CSM)",
        "Large partner ecosystem",
        "Strong brand recognition"
    ],

    pricing: `ServiceNow is notoriously expensive:
- **ITSM Pro**: $100-150/agent/month
- **ITSM Enterprise**: $150-200/agent/month
- Plus implementation costs: $500K-2M+
- Typical 3-year TCO for 1000 employees: $2-5M`,

    whenTheyWin: [
        "Complex enterprise with 10,000+ employees",
        "Heavy customization requirements",
        "Existing ServiceNow footprint (expansion deals)",
        "Large implementation budget and timeline flexibility",
        "CIO mandates a 'safe' choice"
    ],

    whenWeWin: [
        "Speed to value is critical (weeks vs. months)",
        "AI-first approach is a priority",
        "Modern UX matters (employee experience focus)",
        "Total cost of ownership is a concern",
        "IT team is lean and can't manage complexity",
        "Multi-department use case (IT + HR + Finance) on day one"
    ],

    landmines: [
        "❌ Never say 'ServiceNow is too expensive' - they'll justify it",
        "❌ Avoid direct feature comparisons - they'll always have more checkboxes",
        "❌ Don't promise we can do everything they do - focus on what matters",
        "❌ Never badmouth their technology directly"
    ],

    positioning: [
        "Frame as MODERN vs. LEGACY, not better vs. worse",
        "Emphasize AI-NATIVE architecture vs. AI bolted on",
        "Focus on SPEED TO VALUE (weeks vs. 6-12 months)",
        "Highlight EMPLOYEE EXPERIENCE not just IT efficiency",
        "Position as the platform for the NEXT 10 YEARS"
    ],

    discoveryQuestions: [
        "How long did your last ServiceNow implementation take?",
        "What percentage of requests are still handled manually?",
        "How do employees rate their experience with the current portal?",
        "What's your current MTTR and first-contact resolution rate?",
        "How many FTEs are dedicated to maintaining ServiceNow?",
        "What's the timeline for your current contract renewal?",
        "If you could change one thing about your current setup, what would it be?"
    ],

    whyChange: `**The ServiceNow Change Narrative:**

ServiceNow was built in 2004 for a different era - one where IT was about ticket management, not employee experience. It's excellent at what it was designed to do, but the world has changed.

Today's employees expect consumer-grade experiences. They don't want to fill out forms and wait for tickets - they want instant answers through chat. That's why we built Atomicwork from the ground up for this new reality.

The question isn't whether ServiceNow works - it's whether it's the right investment for the next 10 years. The cost of maintaining that complexity only grows, while the gap to modern employee expectations widens.`,

    nextSteps: [
        "Request a specific pain point POC (e.g., HR onboarding)",
        "Propose a parallel evaluation during their renewal period",
        "Offer to benchmark their current metrics vs. ours",
        "Connect them with a reference customer who switched",
        "Suggest a 30-day pilot focused on high-volume, low-complexity tickets"
    ]
};

export default function BattlecardDetailPage() {
    const router = useRouter();
    const params = useParams();
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const card = MOCK_BATTLECARD; // TODO: Fetch by id

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
                <div className="flex items-center gap-4 flex-1">
                    <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                        <Building2 className="h-7 w-7 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            {card.competitorName}
                            <Badge className="bg-red-100 text-red-700">Battlecard</Badge>
                        </h1>
                        <p className="text-sm text-muted-foreground">Competitive Intelligence</p>
                    </div>
                </div>
            </div>

            {/* Tabs for different sections */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="positioning">Win/Lose</TabsTrigger>
                    <TabsTrigger value="discovery">Discovery</TabsTrigger>
                    <TabsTrigger value="strategy">Strategy</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Competitor Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-sm max-w-none">
                                <p className="whitespace-pre-wrap text-sm">{card.overview}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-4">
                        <Card className="border-red-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                                    <Target className="h-5 w-5" />
                                    Their Strengths
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {card.strengths.map((s, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="text-red-500">•</span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    💰 Pricing Intel
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap text-sm">{card.pricing}</p>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Win/Lose Tab */}
                <TabsContent value="positioning" className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Card className="border-red-200">
                            <CardHeader className="pb-3 bg-red-50 rounded-t-lg">
                                <CardTitle className="text-lg text-red-700">
                                    🔴 When They Win
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <ul className="space-y-3">
                                    {card.whenTheyWin.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="text-red-500 font-bold">→</span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card className="border-green-200">
                            <CardHeader className="pb-3 bg-green-50 rounded-t-lg">
                                <CardTitle className="text-lg text-green-700">
                                    🟢 When We Win
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <ul className="space-y-3">
                                    {card.whenWeWin.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="text-green-500 font-bold">→</span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-amber-200">
                        <CardHeader className="pb-3 bg-amber-50 rounded-t-lg">
                            <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                                <AlertTriangle className="h-5 w-5" />
                                Landmines - What NOT to Say
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <ul className="space-y-3">
                                {card.landmines.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm p-2 bg-amber-50 rounded">
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-200">
                        <CardHeader className="pb-3 bg-blue-50 rounded-t-lg">
                            <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                                <Navigation className="h-5 w-5" />
                                Best Positioning Angles
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <ul className="space-y-3">
                                {card.positioning.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center">
                                            {i + 1}
                                        </span>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Discovery Tab */}
                <TabsContent value="discovery" className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Search className="h-5 w-5 text-purple-600" />
                                Discovery Questions to Expose Weaknesses
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {card.discoveryQuestions.map((q, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-medium flex items-center justify-center">
                                            {i + 1}
                                        </span>
                                        <p className="text-sm flex-1">{q}</p>
                                        <CopyButton text={q} fieldId={`discovery-${i}`} />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Strategy Tab */}
                <TabsContent value="strategy" className="space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                💡 Why Change Narrative
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="relative">
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="whitespace-pre-wrap text-sm">{card.whyChange}</p>
                            </div>
                            <div className="absolute top-2 right-2">
                                <CopyButton text={card.whyChange} fieldId="whyChange" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ArrowRight className="h-5 w-5 text-green-600" />
                                Recommended Next Steps
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                                {card.nextSteps.map((step, i) => (
                                    <li key={i} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-medium flex items-center justify-center">
                                            {i + 1}
                                        </span>
                                        <p className="text-sm flex-1">{step}</p>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
