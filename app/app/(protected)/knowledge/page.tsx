
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, FileText, Video, Trash2, Clock, Sparkles, GraduationCap, BookOpen, Layers, Map, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'

interface KnowledgeSource {
  id: string
  title: string
  description?: string
  type: string
  category?: string
  tags: string[]
  status: string
  summary?: string
  fileSize?: number
  fileName?: string
  videoUrl?: string
  createdAt: string
}

interface Quiz {
  id: string
  title: string
  description: string
  _count: { questions: number }
  difficulty: string
  sources?: { title: true }[]
}

interface LearningModule {
  id: string
  title: string
  type: string
  orderIndex: number
  progress: { status: string }[]
}

interface LearningPath {
  id: string
  title: string
  description: string
  targetRole: string
  modules: LearningModule[]
}

export default function KnowledgePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('documents')

  // Data
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([])
  const [loading, setLoading] = useState(true)

  // Actions
  const [uploading, setUploading] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [generatingQuiz, setGeneratingQuiz] = useState(false)
  const [seedingPaths, setSeedingPaths] = useState(false)

  // Forms
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [textContent, setTextContent] = useState('')
  const [questionCount, setQuestionCount] = useState(5)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const userRes = await fetch('/api/auth/me');
      if (userRes.ok) {
        const userData = await userRes.json();
        const userId = userData.user.id;

        // Parallel fetch
        const [kRes, qRes, pRes] = await Promise.all([
          fetch('/api/knowledge'),
          fetch(`/api/learning/quiz?userId=${userId}`),
          fetch(`/api/learning/path?userId=${userId}`)
        ]);

        if (kRes.ok) {
          const data = await kRes.json();
          setKnowledgeSources(data.knowledgeSources);
        }
        if (qRes.ok) {
          const qData = await qRes.json();
          setQuizzes(qData.quizzes || []);
        }
        if (pRes.ok) {
          const pData = await pRes.json();
          setLearningPaths(pData.paths || []);
        }
      }
    } catch (e) {
      console.error("Failed to fetch data", e)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!title) { alert('Title required'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      formData.append('type', files.length > 0 ? 'document' : 'text');

      if (files.length > 0) files.forEach(f => formData.append('files', f));
      else formData.append('content', textContent);

      const response = await fetch('/api/knowledge/upload', { method: 'POST', body: formData })

      if (response.ok) {
        setShowUploadDialog(false)
        alert("Upload Complete");
        fetchData()
      } else {
        alert("Upload Failed");
      }
    } catch (e) { console.error(e); alert("Error uploading"); }
    finally { setUploading(false) }
  }

  const handleGenerateQuiz = async () => {
    if (selectedIds.size === 0) return;
    setGeneratingQuiz(true);
    try {
      const userRes = await fetch('/api/auth/me');
      const userData = await userRes.json();

      const res = await fetch('/api/learning/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceIds: Array.from(selectedIds),
          userId: userData.user.id,
          count: questionCount,
          difficulty: 'medium'
        })
      });

      const data = await res.json();
      if (data.success) {
        alert("Quiz Generated Successfully!");
        setActiveTab('quizzes');
        fetchData();
        setSelectedIds(new Set());
      } else {
        alert("Failed to generate quiz: " + data.error);
      }

    } catch (e) {
      console.error(e);
      alert("Error generating quiz");
    } finally {
      setGeneratingQuiz(false);
    }
  }

  const handleSeedPaths = async () => {
    setSeedingPaths(true);
    try {
      const userRes = await fetch('/api/auth/me');
      const userData = await userRes.json();
      await fetch(`/api/learning/path?userId=${userData.user.id}&action=seed`);
      fetchData();
    } catch (e) { console.error(e); }
    finally { setSeedingPaths(false); }
  }

  const handleModuleToggle = async (moduleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      const userRes = await fetch('/api/auth/me');
      const userData = await userRes.json();

      await fetch('/api/learning/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData.user.id, moduleId, status: newStatus })
      });
      fetchData(); // Refresh to update UI
    } catch (e) { console.error(e); }
  }

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === knowledgeSources.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(knowledgeSources.map(s => s.id)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Knowledge & Learning Hub</h1>
          <p className="text-slate-500 mt-2">Centralized Sales Enablement: Documents, Quizzes, and Training.</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Add Knowledge
          </Button>
        </div>
      </div>

      <Tabs defaultValue="documents" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="documents" className="flex items-center gap-2"><FileText className="h-4 w-4" /> Docs</TabsTrigger>
          <TabsTrigger value="quizzes" className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Quizzes</TabsTrigger>
          <TabsTrigger value="my-plan" className="flex items-center gap-2"><Map className="h-4 w-4" /> My Plan</TabsTrigger>
          <TabsTrigger value="notebooks" className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Knowledge Base</CardTitle>
                  <CardDescription>Select documents to generate comprehensive quizzes.</CardDescription>
                </div>
                {selectedIds.size > 0 && (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-right-5 duration-300">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center space-x-2 bg-secondary/50 px-3 py-1 rounded-md">
                        <span className="text-sm font-medium whitespace-nowrap">Questions:</span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={questionCount}
                          onChange={(e) => setQuestionCount(parseInt(e.target.value) || 5)}
                          className="w-16 h-8 text-center"
                        />
                      </div>
                      <Button variant="secondary" onClick={handleGenerateQuiz} disabled={generatingQuiz}>
                        {generatingQuiz ? <Clock className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4 text-purple-600" />}
                        Generate Quiz from {selectedIds.size} docs
                      </Button>
                    </div>
                    <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {knowledgeSources.length > 0 && (
                  <div className="flex items-center mb-4 px-4">
                    <Checkbox
                      checked={selectedIds.size === knowledgeSources.length}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="ml-2 text-sm text-muted-foreground">Select All</span>
                  </div>
                )}
                {knowledgeSources.map(source => (
                  <div key={source.id} className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${selectedIds.has(source.id) ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center space-x-4">
                      <Checkbox
                        checked={selectedIds.has(source.id)}
                        onCheckedChange={() => toggleSelection(source.id)}
                      />
                      <div className="p-2 bg-blue-100 text-blue-600 rounded">
                        {source.type === 'video' ? <Video className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div>
                        <h4 className="font-semibold">{source.title}</h4>
                        <p className="text-sm text-slate-500 capitalize">{source.type}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {knowledgeSources.length === 0 && <p className="text-center text-muted-foreground py-8">No documents found. Upload one to get started.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quizzes" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizzes.length === 0 && <div className="col-span-3 text-center p-10 text-muted-foreground">No quizzes yet. Go to Documents and generate one!</div>}
            {quizzes.map((quiz) => (
              <Card key={quiz.id} className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/learning/quiz/${quiz.id}`)}>
                <CardHeader>
                  <CardTitle className="text-lg">{quiz.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{quiz.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm">
                    <span>{quiz._count?.questions || 0} Questions</span>
                    <span className="capitalize px-2 py-0.5 bg-secondary rounded text-xs">{quiz.difficulty}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-plan" className="mt-6">
          {learningPaths.length === 0 ? (
            <Card className="text-center py-10">
              <CardContent>
                <Layers className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium">No Learning Plan Assigned</h3>
                <p className="text-slate-500 mb-6">Initialize the default onboarding paths for AEs, SEs, and Partners.</p>
                <Button onClick={handleSeedPaths} disabled={seedingPaths}>
                  {seedingPaths ? "Initializing..." : "Initialize Default Plans"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {learningPaths.map(path => {
                const completed = path.modules.filter(m => m.progress?.[0]?.status === 'completed').length;
                const total = path.modules.length;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <Card key={path.id}>
                    <CardHeader>
                      <div className="flex justify-between items-center mb-2">
                        <CardTitle>{path.title}</CardTitle>
                        <span className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">{path.targetRole}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <Progress value={percent} className="w-32 h-2" />
                        <span>{percent}% Complete ({completed}/{total})</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {path.modules.map((module) => {
                        const isCompleted = module.progress?.[0]?.status === 'completed';
                        return (
                          <div key={module.id} className="flex items-center p-3 hover:bg-slate-50 rounded border-b last:border-0">
                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={() => handleModuleToggle(module.id, isCompleted ? 'completed' : 'pending')}
                            />
                            <div className="ml-4 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{module.title}</span>
                                <span className="text-[10px] uppercase tracking-wider text-slate-400 border px-1 rounded">{module.type}</span>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="text-slate-400">
                              {module.type === 'video' ? <PlayCircle className="h-4 w-4" /> : <ArrowRightIcon className="h-4 w-4" />}
                            </Button>
                          </div>
                        )
                      })}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notebooks" className="mt-6">
          <Card><CardHeader><CardTitle>Notebooks</CardTitle></CardHeader><CardContent>Coming Soon...</CardContent></Card>
        </TabsContent>
      </Tabs>

      {showUploadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-[500px]">
            <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" />
              <Input type="file" onChange={e => setFiles(Array.from(e.target.files || []))} />
              <Button onClick={handleUpload} disabled={uploading} className="w-full">Upload</Button>
              <Button variant="ghost" onClick={() => setShowUploadDialog(false)} className="w-full">Cancel</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function ArrowRightIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
  )
}
