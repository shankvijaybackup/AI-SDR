'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Upload, FileText, Video, Link as LinkIcon, Type, Trash2, CheckCircle, Clock, XCircle, Bot, Globe, Sparkles, Edit, Check, GraduationCap, Brain } from 'lucide-react'
import Link from 'next/link'

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

export default function KnowledgePage() {
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Edit state
  const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editTags, setEditTags] = useState('')

  // Persona Gen State
  const [showPersonaDialog, setShowPersonaDialog] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedPersona, setGeneratedPersona] = useState<any>(null)

  // Upload Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('product')
  const [tags, setTags] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [url, setUrl] = useState('')
  const [textContent, setTextContent] = useState('')

  useEffect(() => {
    fetchKnowledgeSources()
  }, [])

  const fetchKnowledgeSources = async () => {
    try {
      const response = await fetch('/api/knowledge')
      if (response.ok) {
        const data = await response.json()
        setKnowledgeSources(data.knowledgeSources)
      }
    } catch (error) {
      console.error('Failed to fetch knowledge sources:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePersona = async () => {
    if (!companyName || !companyUrl) {
      alert("Please enter both Company Name and URL")
      return
    }

    setGenerating(true)
    setGeneratedPersona(null)

    try {
      // Step 1: Search existing knowledge base for content about this company
      let existingKnowledge = ""
      const searchTerms = companyName.toLowerCase().split(/\s+/)

      // Filter knowledge sources that might contain info about this company
      const relevantSources = knowledgeSources.filter(source => {
        const titleMatch = searchTerms.some(term =>
          source.title?.toLowerCase().includes(term)
        )
        const descMatch = searchTerms.some(term =>
          source.description?.toLowerCase().includes(term)
        )
        // Exclude any previously generated personas for this company
        const isNotPersona = source.type !== 'text' || !source.title?.includes('AI Persona')
        return (titleMatch || descMatch) && isNotPersona
      })

      if (relevantSources.length > 0) {
        console.log(`[Persona] Found ${relevantSources.length} existing knowledge sources about "${companyName}"`)
        existingKnowledge = relevantSources.map(s =>
          `[${s.title}]: ${s.description || ''} ${s.summary || ''}`
        ).join('\n\n')
      }

      // Step 2: Call backend with both company info AND existing knowledge
      const res = await fetch("/api/knowledge/persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          url: companyUrl,
          existingKnowledge: existingKnowledge || undefined
        })
      })

      if (!res.ok) throw new Error("Generation failed")

      const data = await res.json()
      setGeneratedPersona(data.persona)
    } catch (err) {
      console.error("Persona Gen Error:", err)
      alert("Failed to generate persona. Check console.")
    } finally {
      setGenerating(false)
    }
  }

  const handleSavePersona = async () => {
    if (!generatedPersona) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('title', `${companyName} - AI Persona`)
      formData.append('description', `Multi-AI generated persona for ${companyName}`)
      formData.append('type', 'text')
      formData.append('category', 'sales')
      formData.append('tags', 'persona, ai-generated, company-research')
      formData.append('content', JSON.stringify(generatedPersona, null, 2))

      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        alert('Persona saved to Knowledge Base!')
        setShowPersonaDialog(false)
        setGeneratedPersona(null)
        setCompanyName('')
        setCompanyUrl('')
        fetchKnowledgeSources()
      } else {
        alert('Failed to save persona')
      }
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleUpload = async () => {
    if (!title) {
      alert('Please enter a title')
      return
    }

    // Auto-detect upload type based on what user provided
    let uploadType: 'document' | 'video' | 'url' | 'text'

    if (files.length > 0) {
      uploadType = 'document'
    } else if (videoUrl) {
      // Check if it's a YouTube URL
      if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        uploadType = 'video'
      } else {
        uploadType = 'url'
      }
    } else if (url) {
      uploadType = 'url'
    } else if (textContent) {
      uploadType = 'text'
    } else {
      alert('Please provide content: upload a file, paste a URL, or enter text')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      formData.append('type', uploadType)
      formData.append('category', category)
      formData.append('tags', tags)

      if (uploadType === 'document' && files.length > 0) {
        files.forEach((file, index) => {
          formData.append('files', file)
        })
      } else if (uploadType === 'video') {
        formData.append('videoUrl', videoUrl)
      } else if (uploadType === 'url') {
        formData.append('url', url || videoUrl)
      } else if (uploadType === 'text') {
        formData.append('content', textContent)
      }

      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        const successCount = result.count || 1
        alert(`${successCount} file(s) uploaded successfully! Processing embeddings...`)
        resetForm()
        setShowUploadDialog(false)
        fetchKnowledgeSources()
      } else {
        const error = await response.json()
        alert(`Upload failed: ${error.error}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge source?')) {
      return
    }

    try {
      const response = await fetch(`/api/knowledge?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchKnowledgeSources()
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} knowledge source(s)?`)) {
      return
    }

    try {
      const ids = Array.from(selectedIds).join(',')
      const response = await fetch(`/api/knowledge?ids=${ids}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || `Deleted ${data.count} knowledge source(s)`)
        setSelectedIds(new Set())
        fetchKnowledgeSources()
      }
    } catch (error) {
      console.error('Bulk delete error:', error)
      alert('Failed to delete knowledge sources')
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === knowledgeSources.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(knowledgeSources.map(s => s.id)))
    }
  }

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleEdit = (source: KnowledgeSource) => {
    setEditingSource(source)
    setEditTitle(source.title)
    setEditDescription(source.description || '')
    setEditCategory(source.category || 'product')
    setEditTags(source.tags.join(', '))
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editingSource) return

    try {
      const response = await fetch(`/api/knowledge/${editingSource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          category: editCategory,
          tags: editTags,
        }),
      })

      if (response.ok) {
        alert('Knowledge source updated successfully!')
        setShowEditDialog(false)
        setEditingSource(null)
        fetchKnowledgeSources()
      } else {
        alert('Failed to update knowledge source')
      }
    } catch (error) {
      console.error('Edit error:', error)
      alert('Failed to update knowledge source')
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setCategory('product')
    setTags('')
    setFiles([])
    setVideoUrl('')
    setUrl('')
    setTextContent('')
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-600 animate-spin" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText className="w-4 h-4" />
      case 'video':
        return <Video className="w-4 h-4" />
      case 'url':
        return <LinkIcon className="w-4 h-4" />
      case 'text':
        return <Type className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Knowledge Base</h1>
          <p className="text-slate-500 mt-2">Upload documents, videos, and content to power your AI SDR</p>
        </div>
        <div className="flex space-x-3">
          <Link href="/knowledge/study">
            <Button variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
              <Brain className="w-4 h-4 mr-2" />
              Study Knowledge Base
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setShowPersonaDialog(true)} className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Persona
          </Button>
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Add Knowledge
          </Button>
        </div>
      </div>

      {/* Persona Dialog */}
      {showPersonaDialog && (
        <Card className="border-2 border-indigo-500 shadow-xl">
          <CardHeader className="bg-indigo-50 border-b border-indigo-100">
            <CardTitle className="flex items-center text-indigo-900">
              <Bot className="w-5 h-5 mr-2" />
              AI Company Persona Generator
            </CardTitle>
            <CardDescription>
              Uses <strong>Perplexity</strong> (Research), <strong>Gemini</strong> (Analysis), and <strong>OpenAI</strong> (Synthesis) to build a deep company profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {!generatedPersona ? (
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    placeholder="e.g. Atomicwork"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website URL</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                      <Globe className="w-4 h-4" />
                    </span>
                    <Input
                      className="rounded-l-none"
                      placeholder="https://atomicwork.com"
                      value={companyUrl}
                      onChange={e => setCompanyUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <Button variant="ghost" onClick={() => setShowPersonaDialog(false)}>Cancel</Button>
                  <Button onClick={handleGeneratePersona} disabled={generating} className="bg-indigo-600 hover:bg-indigo-700">
                    {generating ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Researching (approx 20s)...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-green-50 p-4 rounded-md border border-green-200">
                  <h3 className="font-bold text-green-900 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Persona Generated Successfully!
                  </h3>
                </div>

                <div className="bg-slate-50 p-4 rounded-md border text-sm space-y-2 max-h-96 overflow-y-auto font-mono">
                  <pre>{JSON.stringify(generatedPersona, null, 2)}</pre>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="ghost" onClick={() => setGeneratedPersona(null)}>Back</Button>
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => setShowPersonaDialog(false)}>Close</Button>
                    <Button onClick={handleSavePersona} disabled={uploading}>
                      {uploading ? 'Saving...' : 'Save to Knowledge Base'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showUploadDialog && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle>Add Knowledge Source</CardTitle>
            <CardDescription>Upload documents, videos, or paste content to enhance AI intelligence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Simple instruction */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>📤 Upload anything:</strong> Drag a file, paste a URL, or type content below. We'll automatically detect the type.
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Supported: PDF, Word, Excel, PowerPoint, YouTube videos, web pages, or plain text (max 10 files at once)
              </p>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Product Demo Video, Feature Documentation"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this content"
                rows={2}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="product">Product</option>
                <option value="sales">Sales</option>
                <option value="technical">Technical</option>
                <option value="customer_story">Customer Story</option>
                <option value="objection_handling">Objection Handling</option>
              </select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., AI, automation, demo"
              />
            </div>

            {/* Unified upload interface */}
            <div className="space-y-4 border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50">
              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="file" className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Upload File</span>
                </Label>
                <Input
                  id="file"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv"
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files || [])
                    const combined = [...files, ...newFiles]
                    // Remove duplicates by name
                    const unique = combined.filter((file, index, self) =>
                      index === self.findIndex(f => f.name === file.name)
                    )
                    if (unique.length > 10) {
                      alert('Maximum 10 files allowed at once')
                      return
                    }
                    setFiles(unique)
                    if (unique.length > 0) {
                      setVideoUrl('')
                      setUrl('')
                      setTextContent('')
                    }
                  }}
                  className="cursor-pointer"
                />
                {files.length > 0 && (
                  <div className="text-xs text-green-600">
                    <p className="flex items-center space-x-1 mb-1">
                      <CheckCircle className="w-3 h-3" />
                      <span>Selected {files.length} file{files.length > 1 ? 's' : ''} (max 10):</span>
                    </p>
                    <ul className="ml-5 space-y-0.5">
                      {files.map((f, i) => (
                        <li key={i} className="text-slate-600 flex items-center justify-between">
                          <span>• {f.name}</span>
                          <button
                            type="button"
                            onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                            className="text-red-500 hover:text-red-700 ml-2 text-xs"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="text-red-500 hover:text-red-700 text-xs mt-2"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              <div className="text-center text-sm text-slate-500 font-medium">OR</div>

              {/* URL/YouTube Input */}
              <div className="space-y-2">
                <Label htmlFor="urlInput" className="flex items-center space-x-2">
                  <LinkIcon className="w-4 h-4" />
                  <span>Paste URL (YouTube, website, article)</span>
                </Label>
                <Input
                  id="urlInput"
                  value={videoUrl || url}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value.includes('youtube.com') || value.includes('youtu.be')) {
                      setVideoUrl(value)
                      setUrl('')
                    } else {
                      setUrl(value)
                      setVideoUrl('')
                    }
                    if (value) {
                      setFiles([])
                      setTextContent('')
                    }
                  }}
                  placeholder="https://youtube.com/watch?v=... or https://example.com/article"
                />
                {(videoUrl || url) && (
                  <p className="text-xs text-green-600 flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>{videoUrl ? '🎥 YouTube video detected' : '🔗 Web page detected'}</span>
                  </p>
                )}
              </div>

              <div className="text-center text-sm text-slate-500 font-medium">OR</div>

              {/* Text Content */}
              <div className="space-y-2">
                <Label htmlFor="textContent" className="flex items-center space-x-2">
                  <Type className="w-4 h-4" />
                  <span>Paste or type content</span>
                </Label>
                <Textarea
                  id="textContent"
                  value={textContent}
                  onChange={(e) => {
                    setTextContent(e.target.value)
                    if (e.target.value) {
                      setFiles([])
                      setVideoUrl('')
                      setUrl('')
                    }
                  }}
                  placeholder="Paste product info, sales scripts, objection handling, etc..."
                  rows={6}
                  className="font-mono text-sm"
                />
                {textContent && (
                  <p className="text-xs text-green-600 flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>{textContent.length} characters</span>
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload & Process'}
              </Button>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {showEditDialog && editingSource && (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle>Edit Knowledge Source</CardTitle>
            <CardDescription>Update the details of this knowledge source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editTitle">Title *</Label>
              <Input
                id="editTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCategory">Category</Label>
              <select
                id="editCategory"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="product">Product</option>
                <option value="sales">Sales</option>
                <option value="technical">Technical</option>
                <option value="customer_story">Customer Story</option>
                <option value="objection_handling">Objection Handling</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTags">Tags (comma-separated)</Label>
              <Input
                id="editTags"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
              />
            </div>
            <div className="flex space-x-3">
              <Button onClick={handleSaveEdit}>
                <Check className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Sources List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Knowledge Sources</CardTitle>
              <CardDescription>{knowledgeSources.length} sources uploaded</CardDescription>
            </div>
            {knowledgeSources.length > 0 && (
              <div className="flex items-center space-x-3">
                {selectedIds.size > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-600">
                      {selectedIds.size} selected
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedIds.size === knowledgeSources.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading knowledge sources...</p>
            </div>
          ) : knowledgeSources.length === 0 ? (
            <div className="text-center py-12">
              <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No knowledge sources yet</h3>
              <p className="text-slate-500 mt-2">Upload documents to get started</p>
              <Button className="mt-4" onClick={() => setShowUploadDialog(true)}>
                Add First Knowledge Source
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {knowledgeSources.map((source) => (
                <div
                  key={source.id}
                  className={`flex items-start justify-between p-4 rounded-lg border transition-colors ${selectedIds.has(source.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-300'
                    }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(source.id)}
                        onChange={() => handleSelectOne(source.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="pt-1 text-slate-500">
                      {getTypeIcon(source.type)}
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900">{source.title}</h3>
                      {source.description && (
                        <p className="text-sm text-slate-500 line-clamp-1">{source.description}</p>
                      )}

                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize 
                          ${source.status === 'completed' ? 'bg-green-100 text-green-800' :
                            source.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'}`}>
                          {getStatusIcon(source.status)}
                          <span className="ml-1">{source.status}</span>
                        </span>

                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                          {source.category || 'Uncategorized'}
                        </span>

                        {source.tags.length > 0 && (
                          <span className="text-xs text-slate-400">
                            {source.tags.slice(0, 3).join(', ')}
                          </span>
                        )}

                        <span className="text-xs text-slate-400">
                          {new Date(source.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(source)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(source.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


    </div>
  )
}
