'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CsvUpload } from '@/components/csv-upload'
import { Plus, FileText, Trash2, Star, Upload as UploadIcon } from 'lucide-react'

interface Script {
  id: string
  name: string
  content: string
  isDefault: boolean
  createdAt: string
}

const AVAILABLE_VARIABLES = [
  { key: '{{firstName}}', description: 'Lead\'s first name' },
  { key: '{{lastName}}', description: 'Lead\'s last name' },
  { key: '{{company}}', description: 'Lead\'s company' },
  { key: '{{jobTitle}}', description: 'Lead\'s job title' },
  { key: '{{repName}}', description: 'Your name' },
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
          <h1 className="text-3xl font-bold text-slate-900">Scripts</h1>
          <p className="text-slate-500 mt-2">Manage your call scripts and templates</p>
        </div>
        <div className="flex items-center space-x-3">
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
                    className="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
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
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No scripts yet</h3>
            <p className="text-slate-500 mb-4">Create your first call script to get started</p>
            <Button onClick={() => setShowNewScript(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Script
            </Button>
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
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
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
