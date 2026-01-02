'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { BrainCircuit, BookOpen, Loader2 } from 'lucide-react'
import { MindMapViewer } from './mindmap-viewer'
import { FlashcardViewer } from './flashcard-viewer'
import { generateMindMap, generateFlashcards } from '@/app/actions/knowledge-generators'

interface StudyDialogProps {
    source: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function StudyDialog({ source, open, onOpenChange }: StudyDialogProps) {
    const [activeTab, setActiveTab] = useState('mindmap')
    const [loading, setLoading] = useState(false)
    const [mindMapData, setMindMapData] = useState<any>(null)
    const [flashcardsData, setFlashcardsData] = useState<any>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        if (open && source) {
            loadTabContent(activeTab)
        }
    }, [open, source, activeTab])

    const loadTabContent = async (tab: string) => {
        setLoading(true)
        setError('')
        try {
            if (tab === 'mindmap' && !mindMapData) {
                const data = await generateMindMap(source.id)
                if (data && data.data) {
                    setMindMapData(data.data) // data.data contains nodes/edges
                }
            } else if (tab === 'flashcards' && !flashcardsData) {
                const data = await generateFlashcards(source.id)
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        <div className="flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5 text-indigo-600" />
                            Study Mode: {source?.title}
                        </div>
                    </DialogTitle>
                    <DialogDescription>
                        Master this content with AI-generated visual maps and flashcards.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden mt-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="mindmap">
                                <BrainCircuit className="w-4 h-4 mr-2" />
                                Mind Map
                            </TabsTrigger>
                            <TabsTrigger value="flashcards">
                                <BookOpen className="w-4 h-4 mr-2" />
                                Flashcards
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-auto mt-4 border rounded-md bg-slate-50 p-4">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                    <p>Generating {activeTab === 'mindmap' ? 'Mind Map' : 'Flashcards'} with AI...</p>
                                    <p className="text-xs mt-2">This may take a few seconds.</p>
                                </div>
                            ) : error ? (
                                <div className="h-full flex items-center justify-center text-red-500">
                                    {error}
                                </div>
                            ) : (
                                <>
                                    <TabsContent value="mindmap" className="h-full mt-0">
                                        {mindMapData && <MindMapViewer data={mindMapData} />}
                                    </TabsContent>
                                    <TabsContent value="flashcards" className="h-full mt-0">
                                        {flashcardsData && <FlashcardViewer cards={flashcardsData} />}
                                    </TabsContent>
                                </>
                            )}
                        </div>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    )
}
