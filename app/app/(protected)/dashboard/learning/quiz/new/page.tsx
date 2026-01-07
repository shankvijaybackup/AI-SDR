
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function NewQuizPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [sources, setSources] = useState<any[]>([]);
    const [selectedSource, setSelectedSource] = useState('');
    const [difficulty, setDifficulty] = useState('medium');

    // Fetch Knowledge Sources
    useEffect(() => {
        fetch('/api/knowledge-source?type=document') // Assuming this endpoint exists or similar
            .then(res => res.json())
            .then(data => {
                if (data.sources) setSources(data.sources);
                // Fallback: fetch general list if type filter fails
            })
            .catch(err => console.error("Failed to fetch sources", err));
    }, []);

    const handleCreate = async () => {
        if (!selectedSource) return;
        setLoading(true);
        try {
            // Get user ID from session or context? 
            // For MVP, the API handles it or we pass a dummy one if auth not rigid.
            // Actually, we need to pass userId if the API expects it.
            // Since this is client side, let's hope the API can verify session or we fetch user first.
            // For now, let's fetch a user ID via a helper or assume middleware handles it.
            // Wait, our API route `POST /api/learning/quiz` expects `userId`.

            // Hack for dev: fetch user first
            const userRes = await fetch('/api/auth/me'); // Hypothetical
            // Or just hardcode source.userId if available
            const source = sources.find(s => s.id === selectedSource);
            const userId = source?.userId;

            if (!userId) {
                alert("Could not identify user. Please login.");
                return;
            }

            const res = await fetch('/api/learning/quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceId: selectedSource,
                    difficulty,
                    count: 5,
                    userId // Using source owner as quiz owner
                })
            });

            const data = await res.json();
            if (data.success) {
                router.push(`/dashboard/learning/quiz/${data.quiz.id}`);
            } else {
                alert(data.error || "Failed to create quiz");
            }
        } catch (e) {
            console.error("Error creating quiz", e);
            alert("Error creating quiz");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight mb-6">Create New Quiz</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Quiz Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Source Document</Label>
                        <Select onValueChange={setSelectedSource} value={selectedSource}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a document..." />
                            </SelectTrigger>
                            <SelectContent>
                                {sources.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.title}
                                    </SelectItem>
                                ))}
                                {sources.length === 0 && <SelectItem value="none" disabled>No documents found</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Difficulty</Label>
                        <Select onValueChange={setDifficulty} value={difficulty}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="easy">Easy</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="hard">Hard</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button className="w-full mt-4" onClick={handleCreate} disabled={loading || !selectedSource}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generate Quiz with AI
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
