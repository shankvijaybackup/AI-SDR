'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Mail, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface EmailTemplate {
    id: string
    name: string
    subject: string
    body: string
    triggerType: string
    delayMinutes: number
    isActive: boolean
    createdAt: string
}

const TRIGGER_TYPES = [
    { value: 'post_call_high', label: 'High Interest (Post-Call)' },
    { value: 'post_call_medium', label: 'Medium Interest (Post-Call)' },
    { value: 'post_call_low', label: 'Low Interest (Post-Call)' },
    { value: 'post_call_not_interested', label: 'Not Interested (Post-Call)' },
    { value: 'demo_reminder', label: 'Demo Reminder' },
    { value: 'follow_up', label: 'General Follow-up' },
    { value: 'voicemail', label: 'Voicemail Drop Follow-up' }
]

export default function EmailTemplatesPage() {
    const [templates, setTemplates] = useState<EmailTemplate[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        subject: '',
        body: '',
        triggerType: 'post_call_medium',
        delayMinutes: 0
    })

    useEffect(() => {
        fetchTemplates()
    }, [])

    const fetchTemplates = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/email-templates')
            if (res.ok) {
                const data = await res.json()
                setTemplates(data)
            }
        } catch (error) {
            console.error('Failed to load templates', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            const url = editingTemplate
                ? `/api/email-templates/${editingTemplate.id}`
                : '/api/email-templates'

            const method = editingTemplate ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (res.ok) {
                alert(editingTemplate ? 'Template updated' : 'Template created')
                fetchTemplates()
                setIsDialogOpen(false)
                resetForm()
            } else {
                const data = await res.json()
                alert(data.error || 'Operation failed')
            }
        } catch (error) {
            alert('Something went wrong')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return

        try {
            const res = await fetch(`/api/email-templates/${id}`, { method: 'DELETE' })
            if (res.ok) {
                alert('Template deleted')
                fetchTemplates()
            } else {
                alert('Failed to delete template')
            }
        } catch (error) {
            alert('Error deleting template')
        }
    }

    const openEditDialog = (template: EmailTemplate) => {
        setEditingTemplate(template)
        setFormData({
            name: template.name,
            subject: template.subject,
            body: template.body,
            triggerType: template.triggerType,
            delayMinutes: template.delayMinutes
        })
        setIsDialogOpen(true)
    }

    const resetForm = () => {
        setEditingTemplate(null)
        setFormData({
            name: '',
            subject: '',
            body: '',
            triggerType: 'post_call_medium',
            delayMinutes: 0
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Email Templates</h1>
                    <p className="text-slate-500 mt-2">Automate your follow-up emails based on call outcomes</p>
                </div>
                <Button onClick={() => { resetForm(); setIsDialogOpen(true) }} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
                    <Plus className="w-4 h-4 mr-2" />
                    New Template
                </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-xl border-slate-200">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
                        <DialogDescription>
                            Set up an automated email to be sent based on call triggers.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Template Name</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. High Interest Follow-up"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="trigger">Trigger</Label>
                                <select
                                    id="trigger"
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 h-9"
                                    value={formData.triggerType}
                                    onChange={e => setFormData({ ...formData, triggerType: e.target.value })}
                                >
                                    {TRIGGER_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subject">Email Subject</Label>
                            <Input
                                id="subject"
                                value={formData.subject}
                                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                placeholder="Following up on our conversation..."
                                required
                            />
                            <p className="text-xs text-slate-500">Variables supported: {'{{firstName}}, {{company}}, {{myFirstName}}'}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="body">Email Body (HTML)</Label>
                            <Textarea
                                id="body"
                                value={formData.body}
                                onChange={e => setFormData({ ...formData, body: e.target.value })}
                                placeholder="Hi {{firstName}}, great speaking with you..."
                                className="min-h-[200px] font-mono text-sm"
                                required
                            />
                            <div className="flex gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                <Info className="w-4 h-4" />
                                <span>Available vars: {'{{firstName}}, {{lastName}}, {{company}}, {{notes}}, {{nextSteps}}'}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="space-y-2 w-1/3">
                                <Label htmlFor="delay">Delay (minutes)</Label>
                                <Input
                                    id="delay"
                                    type="number"
                                    min="0"
                                    value={formData.delayMinutes}
                                    onChange={e => setFormData({ ...formData, delayMinutes: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                                {editingTemplate ? 'Save Changes' : 'Create Template'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Templates Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
            ) : templates.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">No templates yet</h3>
                    <p className="text-slate-500 mt-1">Create your first email template to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map(template => (
                        <Card key={template.id} className="hover:shadow-lg transition-all duration-300 border-slate-200">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline" className={`
                    ${template.triggerType.includes('high') ? 'bg-green-50 text-green-700 border-green-200' :
                                            template.triggerType.includes('medium') ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                'bg-slate-50 text-slate-700 border-slate-200'}
                  `}>
                                        {TRIGGER_TYPES.find(t => t.value === template.triggerType)?.label || template.triggerType}
                                    </Badge>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => openEditDialog(template)}>
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => handleDelete(template.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <CardTitle className="text-lg mt-2 truncate" title={template.name}>{template.name}</CardTitle>
                                <CardDescription className="truncate">Subject: {template.subject}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-slate-50 p-3 rounded-md text-xs text-slate-600 h-24 overflow-hidden border border-slate-100 relative">
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-50/90 pointer-events-none" />
                                    {template.body.replace(/<[^>]*>?/gm, '')}
                                </div>
                                <div className="mt-4 flex items-center text-xs text-slate-400">
                                    <span className="flex items-center">
                                        Delay: {template.delayMinutes} mins
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
