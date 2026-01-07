
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, use } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, User, Bot, Loader2, Trophy, AlertTriangle } from 'lucide-react';

interface Message {
    role: 'user' | 'model';
    content: string;
}

interface Scenario {
    title: string;
    personaName: string;
    personaRole: string;
    objectives: string[];
}

export default function RoleplaySessionPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { id: sessionId } = use(params);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [scenario, setScenario] = useState<Scenario | null>(null);
    const [feedback, setFeedback] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Initial Fetch (Should get session details + history)
    // For MVP, just assuming start and local state, but we really should fetch from DB if rejoining.
    // Let's implement a fetchSession API call or use the previous POST response if we passed state (we didn't).
    // So we fetch session.
    // Wait, I didn't make a GET session endpoint.
    // I entered this "blind". I should add GET /api/roleplay/[id] later.
    // For now, let's just initialize assuming it's new or empty history.
    // Actually, I can use the same generic POST 'chat' to execute a 'load' action if I wanted, or just standard GET.

    // Let's assume we fetch the scenario details at least.

    useEffect(() => {
        // Mock fetch or real implementation
        // fetch(`/api/roleplay/${sessionId}`)...
        // Since I don't have it, I'll rely on the user start context or just show generic for now?
        // No, that's bad UX. I need the scenario details.
        // I will implement a GET endpoint in Step 2 of this fix.
    }, [sessionId]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const res = await fetch('/api/roleplay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat',
                    sessionId,
                    message: userMsg
                })
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => [...prev, { role: 'model', content: data.response }]);
            } else {
                setMessages(prev => [...prev, { role: 'model', content: "Error: " + data.error }]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleEndSession = async () => {
        if (!confirm("End session and generate feedback?")) return;
        setLoading(true);
        try {
            const res = await fetch('/api/roleplay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'end', sessionId })
            });
            const data = await res.json();
            if (data.success) {
                setFeedback(data.result);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto h-[calc(100vh-6rem)] flex flex-col gap-4">
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="border-b bg-slate-50/50">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Bot className="h-5 w-5 text-blue-600" />
                                {scenario ? `${scenario.personaName} (${scenario.personaRole})` : 'AI Persona'}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                                {scenario ? scenario.title : 'Sales Simulation'}
                            </p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={handleEndSession}>
                            End & Score
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30" ref={scrollRef}>
                    {messages.length === 0 && (
                        <div className="text-center text-slate-400 py-10">
                            <Bot className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>Start the conversation by introducing yourself.</p>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {m.role === 'model' && (
                                <Avatar className="h-8 w-8 border bg-white">
                                    <AvatarImage src="/persona.png" />
                                    <AvatarFallback><Bot className="h-4 w-4 text-blue-600" /></AvatarFallback>
                                </Avatar>
                            )}
                            <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm shadow-sm ${m.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-tr-sm'
                                    : 'bg-white border text-slate-800 rounded-tl-sm'
                                }`}>
                                {m.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-2 items-center text-slate-400 text-xs ml-12">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>{scenario?.personaName || 'AI'} is typing...</span>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="p-4 border-t bg-white">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 w-full">
                        <Input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Type your response..."
                            className="flex-1"
                            disabled={loading || !!feedback}
                            autoFocus
                        />
                        <Button type="submit" disabled={loading || !input.trim() || !!feedback}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </CardFooter>
            </Card>

            {/* Feedback Modal / Overlay */}
            {feedback && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg animate-in zoom-in-95 duration-200">
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                                <Trophy className="h-6 w-6 text-yellow-600" />
                            </div>
                            <CardTitle className="text-2xl">Session Score: {feedback.score}/100</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                                {feedback.feedback}
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={() => router.push('/dashboard/learning/roleplay')}>
                                Back to Scenarios
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
}
