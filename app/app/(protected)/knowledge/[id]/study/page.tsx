'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { BrainCircuit, BookOpen, Loader2, ArrowLeft } from 'lucide-react'
import { MindMapViewer } from '@/components/knowledge/mindmap-viewer'
import { FlashcardViewer } from '@/components/knowledge/flashcard-viewer'
import { generateMindMap, generateFlashcards } from '@/app/actions/knowledge-generators'

export default function StudyPage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string

    const [activeTab, setActiveTab] = useState('mindmap')
    const [loading, setLoading] = useState(false)
    const [mindMapData, setMindMapData] = useState<any>(null)
    const [flashcardsData, setFlashcardsData] = useState<any>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        if (id) {
            loadTabContent(activeTab)
        }
    }, [id, activeTab])

    const loadTabContent = async (tab: string) => {
        // Avoid re-fetching if data already exists
        if (tab === 'mindmap' && mindMapData) return
        if (tab === 'flashcards' && flashcardsData) return

        setLoading(true)
        setError('')
        try {
            if (tab === 'mindmap') {
                const data = await generateMindMap(id)
                if (data && data.data) {
                    setMindMapData(data.data)
                }
            } else if (tab === 'flashcards') {
                const data = await generateFlashcards(id)
                setFlashcardsData(data)
            }
        } catch (err: any) {
            console.error('Failed to load study content:', err)
            setError('Failed to generate content. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-6 space-y-4">
            <div className="flex items-center space-x-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Knowledge
                </Button>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <BrainCircuit className="w-6 h-6 text-indigo-600" />
                    Study Mode
                </h1>
            </div>

            <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="border-b px-4 py-2 bg-slate-50">
                        <TabsList>
                            <TabsTrigger value="mindmap" className="flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4" />
                                Mind Map
                            </TabsTrigger>
                            <TabsTrigger value="flashcards" className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                Flashcards
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        {loading && (
                            <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center">
                                <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
                                <p className="text-lg font-medium text-slate-700">
                                    Generating {activeTab === 'mindmap' ? 'Mind Map' : 'Flashcards'}...
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center">
                                <div className="text-red-500 bg-red-50 p-4 rounded-md border border-red-200">
                                    {error}
                                </div>
                            </div>
                        )}

                        <TabsContent value="mindmap" className="h-full m-0 p-0">
                            {mindMapData && (
                                // Override height to fill container
                                <div className="h-full w-full">
                                    <MindMapViewer data={mindMapData} />
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="flashcards" className="h-full m-0 p-8 overflow-auto flex items-center justify-center bg-slate-50">
                            {flashcardsData && (
                                <div className="w-full max-w-2xl">
                                    <FlashcardViewer cards={flashcardsData} />
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
