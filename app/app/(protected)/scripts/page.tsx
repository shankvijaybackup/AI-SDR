'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CsvUpload } from '@/components/csv-upload'
import { Plus, FileText, Trash2, Star, Upload as UploadIcon, Sparkles, BookOpen, Loader2, CheckCircle } from 'lucide-react'

interface Script {
  id: string
  name: string
  content: string
  isDefault: boolean
  createdAt: string
}

interface KnowledgeSource {
  id: string
  title: string
  description?: string
  type: string
  category?: string
}

const AVAILABLE_VARIABLES = [
  { key: '{{firstName}}', description: 'Lead\'s first name' },
  { key: '{{lastName}}', description: 'Lead\'s last name' },
  { key: '{{company}}', description: 'Lead\'s company' },
  { key: '{{jobTitle}}', description: 'Lead\'s job title' },
  { key: '{{repName}}', description: 'Your name' },
]

const SCRIPT_TYPES = [
  { value: 'cold_call', label: 'Cold Call Opening' },
  { value: 'follow_up', label: 'Follow-up Call' },
  { value: 'demo', label: 'Demo Script' },
  { value: 'objection', label: 'Objection Handling' },
  { value: 'closing', label: 'Closing Script' },
]

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [editingScript, setEditingScript] = useState<Script | null>(null)
  const [showNewScript, setShowNewScript] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    isDefault: false,
  })

  // AI Generation state
  const [showAIGenerate, setShowAIGenerate] = useState(false)
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([])
  const [selectedSources, setSelectedSources] = useState<string[]>([])
  const [scriptType, setScriptType] = useState('cold_call')
  const [targetPersona, setTargetPersona] = useState('B2B decision makers')
  const [generating, setGenerating] = useState(false)
  const [generatedScript, setGeneratedScript] = useState<{ name: string; content: string } | null>(null)

  useEffect(() => {
    fetchScripts()
  }, [])

  const fetchScripts = async () => {
    try {
      const response = await fetch('/api/scripts')
      if (response.ok) {
        const data = await response.json()
        setScripts(data.scripts)
      }
    } catch (error) {
      console.error('Failed to fetch scripts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchKnowledgeSources = async () => {
    try {
      const response = await fetch('/api/knowledge')
      if (response.ok) {
        const data = await response.json()
        setKnowledgeSources(data.knowledgeSources || [])
      }
    } catch (error) {
      console.error('Failed to fetch knowledge sources:', error)
    }
  }

  const handleOpenAIGenerate = () => {
    setShowAIGenerate(true)
    setGeneratedScript(null)
    setSelectedSources([])
    fetchKnowledgeSources()
  }

  const handleGenerateScript = async () => {
    if (selectedSources.length === 0) {
      alert('Please select at least one knowledge source')
      return
    }

    setGenerating(true)
    try {
      const response = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledgeSourceIds: selectedSources,
          scriptType,
          targetPersona,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setGeneratedScript(data.script)
      } else {
        const error = await response.json()
        alert(`Failed to generate: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to generate script:', error)
      alert('Failed to generate script')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveGeneratedScript = async () => {
    if (!generatedScript) return

    try {
      const response = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: generatedScript.name,
          content: generatedScript.content,
          isDefault: false,
        }),
      })

      if (response.ok) {
        alert('Script saved successfully!')
        setShowAIGenerate(false)
        setGeneratedScript(null)
        fetchScripts()
      }
    } catch (error) {
      console.error('Failed to save script:', error)
    }
  }

  const toggleSourceSelection = (id: string) => {
    setSelectedSources(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const handleSaveScript = async () => {
    try {
      const url = editingScript ? `/api/scripts/${editingScript.id}` : '/api/scripts'
      const method = editingScript ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        fetchScripts()
        setEditingScript(null)
        setShowNewScript(false)
        setFormData({ name: '', content: '', isDefault: false })
      }
    } catch (error) {
      console.error('Failed to save script:', error)
    }
  }

  const handleDeleteScript = async (id: string) => {
    if (!confirm('Are you sure you want to delete this script?')) return

    try {
      const response = await fetch(`/api/scripts/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchScripts()
      }
    } catch (error) {
      console.error('Failed to delete script:', error)
    }
  }

  const handleEditScript = (script: Script) => {
    setEditingScript(script)
    setFormData({
      name: script.name,
      content: script.content,
      isDefault: script.isDefault,
    })
    setShowNewScript(true)
  }

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content + ' ' + variable
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Scripts</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your call scripts and templates</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button onClick={handleOpenAIGenerate} variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Generate
          </Button>
          <Button onClick={() => setShowUpload(!showUpload)} variant="outline">
            <UploadIcon className="w-4 h-4 mr-2" />
            {showUpload ? 'Hide Upload' : 'Import CSV'}
          </Button>
          <Button onClick={() => {
            setShowNewScript(true)
            setEditingScript(null)
            setFormData({ name: '', content: '', isDefault: false })
          }}>
            <Plus className="w-4 h-4 mr-2" />
            New Script
          </Button>
        </div>
      </div>

      {/* AI Generate Dialog */}
      {showAIGenerate && (
        <Card className="border-2 border-purple-500 shadow-xl dark:border-purple-600">
          <CardHeader className="bg-purple-50 dark:bg-purple-900/30 border-b border-purple-100 dark:border-purple-800">
            <CardTitle className="flex items-center text-purple-900 dark:text-purple-200">
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Script from Knowledge Base
            </CardTitle>
            <CardDescription className="dark:text-purple-300">
              Select knowledge sources to create an AI-powered sales script based on your product info, competitors, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {!generatedScript ? (
              <>
                {/* Script Type */}
                <div className="space-y-2">
                  <Label>Script Type</Label>
                  <select
                    value={scriptType}
                    onChange={(e) => setScriptType(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 dark:bg-slate-800 dark:border-slate-700"
                  >
                    {SCRIPT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Target Persona */}
                <div className="space-y-2">
                  <Label>Target Persona</Label>
                  <Input
                    value={targetPersona}
                    onChange={(e) => setTargetPersona(e.target.value)}
                    placeholder="e.g., IT Directors, CFOs, HR Managers"
                  />
                </div>

                {/* Knowledge Sources Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Select Knowledge Sources ({selectedSources.length} selected)
                  </Label>
                  {knowledgeSources.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center border rounded-lg">
                      No knowledge sources found. Add content to your Knowledge Base first.
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto border rounded-lg divide-y dark:border-slate-700 dark:divide-slate-700">
                      {knowledgeSources.map(source => (
                        <label
                          key={source.id}
                          className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selectedSources.includes(source.id) ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSources.includes(source.id)}
                            onChange={() => toggleSourceSelection(source.id)}
                            className="rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">{source.title}</p>
                            {source.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{source.description}</p>
                            )}
                          </div>
                          {source.category && (
                            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                              {source.category}
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <Button variant="ghost" onClick={() => setShowAIGenerate(false)}>Cancel</Button>
                  <Button
                    onClick={handleGenerateScript}
                    disabled={generating || selectedSources.length === 0}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Script
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Generated Script Preview */
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md border border-green-200 dark:border-green-800">
                  <h3 className="font-bold text-green-900 dark:text-green-300 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Script Generated Successfully!
                  </h3>
                </div>

                <div className="space-y-2">
                  <Label>Script Name</Label>
                  <Input
                    value={generatedScript.name}
                    onChange={(e) => setGeneratedScript({ ...generatedScript, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Script Content</Label>
                  <Textarea
                    value={generatedScript.content}
                    onChange={(e) => setGeneratedScript({ ...generatedScript, content: e.target.value })}
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="ghost" onClick={() => setGeneratedScript(null)}>← Back</Button>
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => setShowAIGenerate(false)}>Discard</Button>
                    <Button onClick={handleSaveGeneratedScript}>
                      Save Script
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showUpload && (
        <CsvUpload
          title="Import Scripts from CSV"
          description="Upload a CSV file with your scripts. Required fields: name, content, isDefault (true/false)."
          endpoint="/api/scripts/import"
          sampleFormat={['name', 'content', 'isDefault']}
          onSuccess={() => {
            fetchScripts()
            setShowUpload(false)
          }}
        />
      )}

      {showNewScript && (
        <Card>
          <CardHeader>
            <CardTitle>{editingScript ? 'Edit Script' : 'Create New Script'}</CardTitle>
            <CardDescription>
              Use variables like {`{{firstName}}`} to personalize your calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="script-name">Script Name</Label>
              <Input
                id="script-name"
                placeholder="e.g., Default Opening Script"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="script-content">Script Content</Label>
              <Textarea
                id="script-content"
                placeholder="Hi {{firstName}}, this is {{repName}} from Atomicwork. How are you doing today?"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label>Available Variables</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((variable) => (
                  <button
                    key={variable.key}
                    onClick={() => insertVariable(variable.key)}
                    className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                    title={variable.description}
                  >
                    {variable.key}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-default"
                checked={formData.isDefault}
                onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="is-default" className="cursor-pointer">
                Set as default script
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Button onClick={handleSaveScript}>
                {editingScript ? 'Update Script' : 'Create Script'}
              </Button>
              <Button variant="outline" onClick={() => {
                setShowNewScript(false)
                setEditingScript(null)
                setFormData({ name: '', content: '', isDefault: false })
              }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading scripts...</p>
          </div>
        ) : scripts.length === 0 ? (
          <div className="col-span-2 text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No scripts yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">Create your first call script to get started</p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={handleOpenAIGenerate} variant="outline" className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Generate
              </Button>
              <Button onClick={() => setShowNewScript(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Script
              </Button>
            </div>
          </div>
        ) : (
          scripts.map((script) => (
            <Card key={script.id} className={script.isDefault ? 'border-primary' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-lg">{script.name}</CardTitle>
                    {script.isDefault && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditScript(script)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteScript(script.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                  {script.content}
                </p>
                <p className="text-xs text-slate-400 mt-4">
                  Created {new Date(script.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

