'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import Link from 'next/link'
import {
    BookOpen,
    Brain,
    GraduationCap,
    Presentation,
    Swords,
    Map,
    MessageSquare,
    Target,
    Upload,
    FileText,
    Sparkles,
    Send,
    ChevronRight,
    Play,
    CheckCircle2,
    Clock,
    TrendingUp,
    Zap
} from 'lucide-react'

// Tab animation variants
const tabContentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
}

// Stats Card Component
function StatCard({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: any }) {
    return (
        <Card className={`bg-gradient-to-br ${color} text-white border-0 shadow-lg`}>
            <CardContent className="p-4 flex items-center justify-between">
                <div>
                    <p className="text-white/80 text-sm">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
                <Icon className="h-8 w-8 text-white/30" />
            </CardContent>
        </Card>
    )
}

// Module Card for Overview
function ModuleCard({ title, subtitle, description, href, icon: Icon, color, bgColor }: any) {
    return (
        <Link href={href}>
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer border-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle className="text-lg font-semibold group-hover:text-blue-600 transition-colors">
                            {title}
                        </CardTitle>
                        <CardDescription className="text-xs uppercase tracking-wide">
                            {subtitle}
                        </CardDescription>
                    </div>
                    <div className={`p-2 rounded-lg ${bgColor} group-hover:scale-110 transition-transform`}>
                        <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{description}</p>
                    <div className="flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium">
                        Open <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}

// Knowledge Tab Content
function KnowledgeTab() {
    const [sources, setSources] = useState<Array<{ id: string; title: string; type: string; createdAt: string }>>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchSources = () => {
        fetch('/api/knowledge-source')
            .then(res => res.json())
            .then(data => {
                setSources(data.sources || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }

    useEffect(() => {
        fetchSources()
    }, [])

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        if (files.length > 10) {
            alert('Maximum 10 files can be uploaded at a time')
            return
        }

        setUploading(true)
        const uploadedCount = { success: 0, failed: 0 }

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const formData = new FormData()
            formData.append('files', file)  // API expects 'files' for multi-file upload
            formData.append('title', file.name.replace(/\.[^/.]+$/, ''))  // Use filename as title
            formData.append('type', 'document')  // Required field

            try {
                const res = await fetch('/api/knowledge/upload', {
                    method: 'POST',
                    body: formData
                })
                if (res.ok) {
                    uploadedCount.success++
                } else {
                    const errData = await res.json().catch(() => ({}))
                    console.error('Upload failed:', errData)
                    uploadedCount.failed++
                }
            } catch (e) {
                console.error('Upload error:', e)
                uploadedCount.failed++
            }
        }

        setUploading(false)
        fetchSources() // Refresh the list

        if (uploadedCount.failed > 0) {
            alert(`Uploaded ${uploadedCount.success} file(s). ${uploadedCount.failed} failed.`)
        }
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files)
        }
    }

    return (
        <div className="space-y-6">
            {/* Hidden File Input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.json"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
            />

            {/* Upload Section */}
            <Card
                className={`border-dashed border-2 transition-colors cursor-pointer ${dragActive
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                    : 'border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <CardContent className="p-8 text-center">
                    {uploading ? (
                        <>
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Uploading...</h3>
                            <p className="text-sm text-muted-foreground">Please wait while files are being uploaded</p>
                        </>
                    ) : (
                        <>
                            <Upload className={`h-12 w-12 mx-auto mb-4 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
                            <h3 className="text-lg font-semibold mb-2">Upload Knowledge</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Drag &amp; drop up to 10 files or click to browse
                            </p>
                            <Button
                                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    fileInputRef.current?.click()
                                }}
                            >
                                <Upload className="h-4 w-4 mr-2" /> Upload Files
                            </Button>
                            <p className="text-xs text-muted-foreground mt-3">
                                Supported: PDF, DOC, DOCX, TXT, MD, JSON
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Document List */}
            <div className="grid gap-3">
                <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" /> Your Documents ({sources.length})
                </h3>
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : sources.length === 0 ? (
                    <Card className="bg-slate-50 dark:bg-slate-800/30">
                        <CardContent className="p-6 text-center text-muted-foreground">
                            No documents yet. Upload your first document above.
                        </CardContent>
                    </Card>
                ) : (
                    <ScrollArea className="h-[400px]">
                        <div className="space-y-2 pr-4">
                            {sources.map((source) => (
                                <Card key={source.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <Checkbox id={source.id} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{source.title}</p>
                                            <p className="text-xs text-muted-foreground">{source.type}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {source.createdAt ? new Date(source.createdAt).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    )
}

// Practice Tab Content
function PracticeTab() {
    const [scenarios, setScenarios] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/roleplay/scenarios')
            .then(res => res.json())
            .then(data => {
                setScenarios(data.scenarios || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    const PRACTICE_MODULES = [
        { title: "Pitch Library", description: "Ready-to-use talk tracks", href: "/dashboard/learning/pitches", icon: Presentation, color: "text-blue-600" },
        { title: "Quizzes", description: "Test your knowledge", href: "/dashboard/learning/quiz", icon: GraduationCap, color: "text-amber-600" },
        { title: "Battlecards", description: "Competitive intel", href: "/dashboard/learning/battlecards", icon: Swords, color: "text-red-600" },
    ]

    return (
        <div className="space-y-6">
            {/* Quick Practice Links */}
            <div className="grid md:grid-cols-3 gap-4">
                {PRACTICE_MODULES.map((mod) => (
                    <Link key={mod.title} href={mod.href}>
                        <Card className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer group">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                                    <mod.icon className={`h-5 w-5 ${mod.color}`} />
                                </div>
                                <div>
                                    <p className="font-medium">{mod.title}</p>
                                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Roleplay Scenarios */}
            <div>
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <MessageSquare className="h-5 w-5" /> AI Roleplay Scenarios
                </h3>
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading scenarios...</div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        {scenarios.map((scenario: any) => (
                            <Card key={scenario.id} className="hover:shadow-lg transition-all group">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-base">{scenario.title}</CardTitle>
                                            <CardDescription>{scenario.personaName} • {scenario.personaRole}</CardDescription>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full ${scenario.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                            scenario.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                            {scenario.difficulty}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{scenario.description}</p>
                                    <Link href={`/dashboard/learning/roleplay/${scenario.id}`}>
                                        <Button size="sm" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                                            <Play className="h-4 w-4 mr-2" /> Start Practice
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// Ask AI Tab Content (Deep Tutor)
function AskAITab() {
    const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [sourceIds, setSourceIds] = useState<string[]>([])

    // Fetch available sources on mount
    useEffect(() => {
        fetch('/api/knowledge-source')
            .then(res => res.json())
            .then(data => {
                const ids = (data.sources || []).map((s: { id: string }) => s.id)
                setSourceIds(ids)
            })
            .catch(() => { })
    }, [])

    const sendMessage = async () => {
        if (!input.trim() || loading) return

        const userMessage = { role: 'user', content: input }
        setMessages(prev => [...prev, userMessage])
        const currentInput = input
        setInput('')
        setLoading(true)

        try {
            // Get userId from cookie
            const cookies = document.cookie.split(';').reduce((acc, c) => {
                const [key, val] = c.trim().split('=')
                acc[key] = val
                return acc
            }, {} as Record<string, string>)

            let userId = 'anonymous'
            if (cookies['auth-token']) {
                try {
                    const payload = JSON.parse(atob(cookies['auth-token'].split('.')[1]))
                    userId = payload.userId || 'anonymous'
                } catch { /* ignore */ }
            }

            // Build history from previous messages - convert 'assistant' to 'model' for Gemini API
            const history = messages
                .filter(m => !m.content.includes('[GoogleGenerativeAI Error]'))  // Skip error messages
                .map(m => ({
                    role: m.role === 'assistant' ? 'model' : m.role,
                    content: m.content
                }))

            const res = await fetch('/api/tutor/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    message: currentInput,
                    sourceIds: sourceIds.length > 0 ? sourceIds : ['all'],
                    history
                })
            })
            const data = await res.json()
            if (data.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'No response received' }])
            }
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to AI service.' }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="h-[600px] flex flex-col">
            {/* Chat Header */}
            <div className="flex items-center gap-3 mb-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                    <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h3 className="font-semibold">Deep Tutor AI</h3>
                    <p className="text-xs text-muted-foreground">Ask questions about your knowledge base</p>
                </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center py-16 text-muted-foreground">
                            <Sparkles className="h-12 w-12 mx-auto mb-4 text-purple-400" />
                            <p className="font-medium">Ask me anything about your documents!</p>
                            <p className="text-sm mt-2">I'll search your knowledge base and provide accurate answers.</p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user'
                                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800'
                                }`}>
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Ask about your knowledge base..."
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                    onClick={sendMessage}
                    disabled={loading}
                    className="px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                    <Send className="h-5 w-5" />
                </Button>
            </div>
        </div>
    )
}

// Main Page Component
export default function EnablementHubPage() {
    const [activeTab, setActiveTab] = useState('overview')

    const LEARNING_MODULES = [
        { title: "Pitch Library", subtitle: "Talk Tracks", description: "Ready-to-use pitches by duration and persona.", href: "/dashboard/learning/pitches", icon: Presentation, color: "text-blue-600", bgColor: "bg-blue-50" },
        { title: "Battlecards", subtitle: "Competitive Intel", description: "Win against competitors with tactical guidance.", href: "/dashboard/learning/battlecards", icon: Swords, color: "text-red-600", bgColor: "bg-red-50" },
        { title: "Onboarding", subtitle: "30-60-90 Plan", description: "Structured ramp with measurable milestones.", href: "/dashboard/learning/onboarding", icon: Map, color: "text-green-600", bgColor: "bg-green-50" },
        { title: "AI Roleplay", subtitle: "Practice Mode", description: "Practice with AI buyers and get feedback.", href: "/dashboard/learning/roleplay", icon: MessageSquare, color: "text-purple-600", bgColor: "bg-purple-50" },
        { title: "Quizzes", subtitle: "Knowledge Check", description: "Test understanding with AI-generated quizzes.", href: "/dashboard/learning/quiz", icon: GraduationCap, color: "text-amber-600", bgColor: "bg-amber-50" },
    ]

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Enablement Hub
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Knowledge • Practice • AI Coaching — All in one place
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-sm text-muted-foreground">Readiness Score</p>
                        <p className="text-2xl font-bold text-green-600">72%</p>
                    </div>
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/25">
                        <Target className="h-7 w-7 text-white" />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 h-14 p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl">
                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md transition-all">
                        <TrendingUp className="h-4 w-4 mr-2" /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="knowledge" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md transition-all">
                        <BookOpen className="h-4 w-4 mr-2" /> Knowledge
                    </TabsTrigger>
                    <TabsTrigger value="practice" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md transition-all">
                        <Zap className="h-4 w-4 mr-2" /> Practice
                    </TabsTrigger>
                    <TabsTrigger value="ask-ai" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-md transition-all">
                        <Brain className="h-4 w-4 mr-2" /> Ask AI
                    </TabsTrigger>
                </TabsList>

                {/* Tab Content with Animation */}
                <TabsContent value="overview" className="mt-0">
                    <motion.div
                        key="tab-overview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                    >
                        {/* Quick Stats */}
                        <div className="grid gap-4 md:grid-cols-4">
                            <StatCard label="Documents" value="12" color="from-blue-500 to-blue-600" icon={FileText} />
                            <StatCard label="Roleplay Sessions" value="8" color="from-purple-500 to-purple-600" icon={MessageSquare} />
                            <StatCard label="Quiz Score" value="85%" color="from-amber-500 to-amber-600" icon={GraduationCap} />
                            <StatCard label="Week Progress" value="Week 4" color="from-green-500 to-green-600" icon={CheckCircle2} />
                        </div>

                        {/* Module Grid */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {LEARNING_MODULES.map((module) => (
                                <ModuleCard key={module.title} {...module} />
                            ))}
                        </div>
                    </motion.div>
                </TabsContent>

                <TabsContent value="knowledge" className="mt-0">
                    <motion.div
                        key="tab-knowledge"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <KnowledgeTab />
                    </motion.div>
                </TabsContent>

                <TabsContent value="practice" className="mt-0">
                    <motion.div
                        key="tab-practice"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <PracticeTab />
                    </motion.div>
                </TabsContent>

                <TabsContent value="ask-ai" className="mt-0">
                    <motion.div
                        key="tab-ask-ai"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <AskAITab />
                    </motion.div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
