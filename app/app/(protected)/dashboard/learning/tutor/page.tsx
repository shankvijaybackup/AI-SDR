
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Bot, User, FileText, Loader2, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Message {
    role: 'user' | 'model';
    content: string;
}

interface KnowledgeSource {
    id: string;
    title: string;
    type: string;
}

export default function DeepTutorPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: "Hello! I'm your Deep Tutor. Select some documents from the right to get started, and ask me anything about them." }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sources, setSources] = useState<KnowledgeSource[]>([]);
    const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch Sources
    useEffect(() => {
        fetch('/api/knowledge')
            .then(res => res.json())
            .then(data => {
                if (data.knowledgeSources) setSources(data.knowledgeSources);
            })
            .catch(err => console.error("Failed to fetch sources", err));
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        if (selectedSourceIds.size === 0) {
            alert("Please select at least one document to chat with.");
            return;
        }

        const userMsg = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        try {
            const userRes = await fetch('/api/auth/me');
            const userData = await userRes.json();

            const res = await fetch('/api/tutor/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userData.user.id,
                    message: userMsg,
                    sourceIds: Array.from(selectedSourceIds),
                    // Send last 10 messages as history context types
                    history: messages.slice(-10).map(m => ({ role: m.role, parts: m.content }))
                })
            });

            const data = await res.json();

            if (data.success) {
                setMessages(prev => [...prev, { role: 'model', content: data.response }]);
            } else {
                setMessages(prev => [...prev, { role: 'model', content: "Error: " + (data.error || "Failed to get response.") }]);
            }

        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered a network error." }]);
        } finally {
            setLoading(false);
        }
    };

    const toggleSource = (id: string) => {
        const newSet = new Set(selectedSourceIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedSourceIds(newSet);
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col h-full">
                <Card className="flex-1 flex flex-col border-0 shadow-none ring-1 ring-slate-200">
                    <CardHeader className="border-b px-6 py-4">
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            Deep Tutor <span className="text-sm font-normal text-muted-foreground ml-2">sales enablement assistant</span>
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="flex-1 p-0 overflow-hidden relative">
                        <div className="h-full overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                            {messages.map((m, i) => (
                                <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {m.role === 'model' && (
                                        <Avatar className="h-8 w-8 border">
                                            <AvatarImage src="/bot-avatar.png" />
                                            <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className={`rounded-lg px-4 py-2 max-w-[80%] text-sm ${m.role === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-900'
                                        }`}>
                                        <div className="whitespace-pre-wrap">{m.content}</div>
                                    </div>
                                    {m.role === 'user' && (
                                        <Avatar className="h-8 w-8 border">
                                            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}
                            {loading && (
                                <div className="flex gap-3 justify-start">
                                    <Avatar className="h-8 w-8 border">
                                        <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                                    </Avatar>
                                    <div className="bg-slate-100 rounded-lg px-4 py-2 flex items-center">
                                        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>

                    <div className="p-4 border-t bg-background">
                        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                            <Input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Ask a question about your documents..."
                                className="flex-1"
                                disabled={loading}
                            />
                            <Button type="submit" disabled={loading || !input.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>

            {/* Sidebar: Source Selection */}
            <div className="w-80 border-l pl-4 hidden md:block">
                <div className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Knowledge Context
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                    Select documents to include in the AI&apos;s context window.
                </div>
                <ScrollArea className="h-[calc(100vh-10rem)] pr-4">
                    <div className="space-y-3">
                        {sources.length === 0 && <div className="text-sm text-muted-foreground">No documents found. Upload some in the Knowledge Hub!</div>}
                        {sources.map(s => (
                            <div key={s.id} className="flex items-start space-x-3 p-2 hover:bg-slate-50 rounded border border-transparent hover:border-slate-200 transition-colors">
                                <Checkbox
                                    id={s.id}
                                    checked={selectedSourceIds.has(s.id)}
                                    onCheckedChange={() => toggleSource(s.id)}
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <label
                                        htmlFor={s.id}
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        {s.title}
                                    </label>
                                    <p className="text-xs text-muted-foreground capitalize">
                                        {s.type}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="mt-4 pt-4 border-t">
                    <div className="text-xs text-slate-500">
                        Selected: {selectedSourceIds.size} documents
                    </div>
                </div>
            </div>
        </div>
    );
}
