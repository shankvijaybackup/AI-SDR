
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { Swords, MessageSquare, ArrowRight } from 'lucide-react';

interface Scenario {
    id: string;
    title: string;
    description: string;
    personaName: string;
    personaRole: string;
    difficulty: string;
    objectives: string[];
}

export default function RoleplayDashboard() {
    const router = useRouter();
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch scenarios (We might need an API route for this, or just use prisma in a server component if we refactor. 
        // For now, let's assuming we have a GET endpoint or adding one.
        // Wait, I haven't added a GET Scenarios endpoint yet. I'll add it to the API route I just made.)
        fetch('/api/roleplay/scenarios')
            .then(res => res.json())
            .then(data => {
                if (data.scenarios) setScenarios(data.scenarios);
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const startSession = async (scenarioId: string) => {
        try {
            const userRes = await fetch('/api/auth/me');
            const userData = await userRes.json();

            const res = await fetch('/api/roleplay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    userId: userData.user.id,
                    scenarioId
                })
            });

            const data = await res.json();
            if (data.success) {
                router.push(`/dashboard/learning/roleplay/${data.session.id}`);
            }
        } catch (e) {
            console.error("Failed to start session", e);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Swords className="h-8 w-8 text-blue-600" />
                    AI Roleplay Simulator
                </h1>
                <p className="text-slate-500 mt-2">Practice your sales pitch against realistic AI personas.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {scenarios.map(s => (
                    <Card key={s.id} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <Badge variant={s.difficulty === 'hard' ? 'destructive' : s.difficulty === 'medium' ? 'secondary' : 'outline'}>
                                    {s.difficulty}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{s.personaRole}</span>
                            </div>
                            <CardTitle className="mt-2">{s.title}</CardTitle>
                            <CardDescription>{s.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-semibold mb-2 uppercase text-slate-400">Objectives</p>
                                    <ul className="text-sm space-y-1 list-disc list-inside text-slate-600">
                                        {s.objectives.slice(0, 3).map((obj, i) => (
                                            <li key={i}>{obj}</li>
                                        ))}
                                    </ul>
                                </div>
                                <Button className="w-full" onClick={() => startSession(s.id)}>
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Start Simulation
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {scenarios.length === 0 && !loading && (
                <div className="text-center p-12 text-muted-foreground">
                    No scenarios found. (Run the seeder if local)
                </div>
            )}
        </div>
    );
}
