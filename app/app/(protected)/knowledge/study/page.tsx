
import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Brain, RotateCw, Layers } from "lucide-react" // Added Layers for Flashcards icon
import Link from "next/link"
import { generateGlobalMindMap, generateGlobalFlashcards } from "@/app/actions/knowledge-generators"
import { MindMapViewer } from "@/components/knowledge/mindmap-viewer"
import { FlashcardViewer } from "@/components/knowledge/flashcard-viewer"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const maxDuration = 300 // 5 minutes for AI generation

async function StudyContent({ userId, type, force = false }: { userId: string, type: 'mindmap' | 'flashcards', force?: boolean }) {
    try {
        if (type === 'mindmap') {
            const mindMap = await generateGlobalMindMap(userId, force)
            if (!mindMap || !mindMap.data) return <div className="p-8 text-center text-muted-foreground">No content available to generate Mind Map.</div>
            const data = mindMap.data as any
            return <MindMapViewer data={{ nodes: data.nodes || [], edges: data.edges || [] }} />
        } else {
            const flashcards = await generateGlobalFlashcards(userId, force)
            if (!flashcards || flashcards.length === 0) return <div className="p-8 text-center text-muted-foreground">No content available to generate Flashcards.</div>
            return <FlashcardViewer cards={flashcards} />
        }
    } catch (error) {
        console.error('Error loading study content:', error)
        return (
            <div className="p-8 text-center text-red-500">
                <p>Failed to generate study content.</p>
                <p className="text-sm text-muted-foreground mt-2">Please try again later.</p>
            </div>
        )
    }
}

export default async function GlobalStudyPage({ searchParams }: { searchParams: Promise<{ tab?: string, force?: string }> }) {
    const user = await getCurrentUser()
    if (!user) redirect('/login')

    const params = await searchParams
    const tab = params.tab || 'mindmap'
    const force = params.force === 'true'

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="border-b bg-white dark:bg-slate-950 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/knowledge">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Knowledge Base
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Brain className="w-6 h-6 text-indigo-500" />
                            Unified Knowledge Base Study
                        </h1>
                        <p className="text-sm text-slate-500">Master all your uploaded materials in one place</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/knowledge/study?tab=${tab}&force=true`}>
                            <RotateCw className="w-4 h-4 mr-2" />
                            Regenerate All
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden p-6">
                <Tabs defaultValue="mindmap" className="h-full flex flex-col" value={tab}>
                    <div className="flex justify-center mb-6 shrink-0">
                        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                            <TabsTrigger value="mindmap" asChild>
                                <Link href="/knowledge/study?tab=mindmap">
                                    <Brain className="w-4 h-4 mr-2" />
                                    Mind Map
                                </Link>
                            </TabsTrigger>
                            <TabsTrigger value="flashcards" asChild>
                                <Link href="/knowledge/study?tab=flashcards">
                                    <Layers className="w-4 h-4 mr-2" />
                                    Flashcards
                                </Link>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden bg-white dark:bg-slate-950 rounded-xl border shadow-sm relative">
                        <TabsContent value="mindmap" className="h-full m-0 p-0 absolute inset-0">
                            <Suspense fallback={
                                <div className="h-full flex items-center justify-center flex-col gap-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
                                    <p className="text-slate-500 animate-pulse">Generating comprehensive Mind Map...</p>
                                </div>
                            }>
                                <StudyContent userId={user.userId} type="mindmap" />
                            </Suspense>
                        </TabsContent>

                        <TabsContent value="flashcards" className="h-full m-0 p-0 absolute inset-0 overflow-y-auto">
                            <Suspense fallback={
                                <div className="h-full flex items-center justify-center flex-col gap-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
                                    <p className="text-slate-500 animate-pulse">Generating global Flashcards...</p>
                                </div>
                            }>
                                <div className="h-full p-8">
                                    <StudyContent userId={user.userId} type="flashcards" />
                                </div>
                            </Suspense>
                        </TabsContent>
                    </div>
                </Tabs>
            </div >
        </div >
    )
}
