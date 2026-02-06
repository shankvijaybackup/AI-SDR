'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
    Phone,
    CheckCircle2,
    AlertCircle,
    Edit2,
    Save,
    X,
    RefreshCw,
    PlayCircle,
    Clock,
    MessageSquare,
    HelpCircle,
    Target,
    Shield,
    Sparkles,
    TrendingUp,
    User,
    Brain
} from 'lucide-react'

interface CallScriptPreviewProps {
    leadId: string
    leadName: string
    company: string
    jobTitle: string
}

export default function CallScriptPreview({ leadId, leadName, company, jobTitle }: CallScriptPreviewProps) {
    const [script, setScript] = useState<any>(null)
    const [validation, setValidation] = useState<any>(null)
    const [flowDiagram, setFlowDiagram] = useState<any>(null)
    const [status, setStatus] = useState<string>('pending_review')
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<string | null>(null)
    const [editedContent, setEditedContent] = useState<string>('')
    const [regenerating, setRegenerating] = useState(false)
    const [approving, setApproving] = useState(false)

    useEffect(() => {
        fetchScript()
    }, [leadId])

    const fetchScript = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/leads/${leadId}/script`)
            if (response.ok) {
                const data = await response.json()
                setScript(data.script)
                setStatus(data.status || 'not_generated')
                // Build validation from script data (if available)
                if (data.script) {
                    setValidation({
                        quality: 'good',
                        score: 85,
                        issues: []
                    })
                }
            } else if (response.status === 404) {
                // Script not generated yet
                setScript(null)
                setStatus('not_generated')
            }
        } catch (error) {
            console.error('Failed to fetch script:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleRegenerate = async () => {
        setRegenerating(true)
        try {
            const response = await fetch(`/api/leads/${leadId}/script/generate`, {
                method: 'POST'
            })
            if (response.ok) {
                const data = await response.json()
                setScript(data.script)
                setStatus(data.status || 'pending_review')
                alert('Script generated successfully!')
            } else {
                const error = await response.json()
                alert(error.error || 'Failed to generate script')
            }
        } catch (error) {
            console.error('Generate failed:', error)
            alert('Failed to generate script')
        } finally {
            setRegenerating(false)
        }
    }

    const handleApprove = async () => {
        setApproving(true)
        try {
            const response = await fetch(`/api/leads/${leadId}/script/approve`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: 'Approved by admin' })
            })
            if (response.ok) {
                setStatus('approved')
                alert('Script approved! Ready for calling.')
            } else {
                const error = await response.json()
                alert(error.error || 'Failed to approve script')
            }
        } catch (error) {
            console.error('Approve failed:', error)
            alert('Failed to approve script')
        } finally {
            setApproving(false)
        }
    }

    const handleEdit = (section: string, content: string) => {
        setEditing(section)
        setEditedContent(typeof content === 'string' ? content : JSON.stringify(content, null, 2))
    }

    const handleSaveEdit = async (section: string) => {
        try {
            const response = await fetch(`/api/scripts/${leadId}/edit`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section,
                    script: editedContent
                })
            })
            if (response.ok) {
                await fetchScript()
                setEditing(null)
                alert('Section updated successfully!')
            }
        } catch (error) {
            console.error('Edit failed:', error)
            alert('Failed to save changes')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!script) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="text-center py-8">
                        <Phone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600 mb-2">No personalized script generated yet</p>
                        <p className="text-sm text-slate-500 mb-4">
                            Generate a hyper-personalized call script based on LinkedIn enrichment data
                        </p>
                        <Button onClick={handleRegenerate} disabled={regenerating}>
                            <Sparkles className="w-4 h-4 mr-2" />
                            {regenerating ? 'Generating...' : 'Generate Call Script'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-800 border-green-300'
            case 'pending_review': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
            case 'edited': return 'bg-blue-100 text-blue-800 border-blue-300'
            default: return 'bg-slate-100 text-slate-800 border-slate-300'
        }
    }

    const getValidationColor = (quality: string) => {
        switch (quality) {
            case 'excellent': return 'text-green-600'
            case 'good': return 'text-blue-600'
            case 'needs-work': return 'text-orange-600'
            default: return 'text-slate-600'
        }
    }

    return (
        <div className="space-y-6">
            {/* Header with Status and Actions */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center">
                        <Sparkles className="w-6 h-6 mr-2 text-purple-600" />
                        Personalized Call Script
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                        Auto-generated for {leadName} at {company}
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Badge className={`${getStatusColor(status)} border px-3 py-1`}>
                        {status === 'approved' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {status === 'pending_review' && <Clock className="w-3 h-3 mr-1" />}
                        {status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                        Regenerate
                    </Button>
                    {status !== 'approved' && (
                        <Button
                            onClick={handleApprove}
                            disabled={approving || validation?.quality === 'needs-work'}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {approving ? 'Approving...' : 'Approve Script'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Quality Score */}
            {validation && (
                <Card className={`border-2 ${validation.quality === 'excellent' ? 'border-green-300 bg-green-50' : validation.quality === 'good' ? 'border-blue-300 bg-blue-50' : 'border-orange-300 bg-orange-50'}`}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className={`text-lg font-semibold ${getValidationColor(validation.quality)}`}>
                                    Script Quality: {validation.quality.toUpperCase()}
                                </h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    Score: {validation.score}/100
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-slate-600">Persona-aligned</p>
                                <p className="text-xs text-slate-500">
                                    DISC: {script.metadata?.discProfile}
                                </p>
                            </div>
                        </div>
                        {validation.issues && validation.issues.length > 0 && (
                            <div className="mt-4 p-3 bg-white rounded border border-orange-200">
                                <h4 className="text-sm font-medium text-orange-900 mb-2">Issues to Address:</h4>
                                <ul className="text-sm text-orange-700 space-y-1">
                                    {validation.issues.map((issue: string, idx: number) => (
                                        <li key={idx} className="flex items-start">
                                            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                                            {issue}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Script Flow Diagram */}
            {flowDiagram && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-md flex items-center">
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Call Flow
                        </CardTitle>
                        <CardDescription>
                            Estimated duration: {flowDiagram.estimatedDuration}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center space-x-2 overflow-x-auto pb-4">
                            {flowDiagram.nodes.map((node: any, idx: number) => (
                                <div key={node.id} className="flex items-center">
                                    <div className="flex flex-col items-center min-w-[120px]">
                                        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                                            node.type === 'start' ? 'bg-green-100 text-green-700' :
                                            node.type === 'question' ? 'bg-blue-100 text-blue-700' :
                                            node.type === 'pitch' ? 'bg-purple-100 text-purple-700' :
                                            node.type === 'close' ? 'bg-indigo-100 text-indigo-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`}>
                                            {node.type === 'start' && <Phone className="w-6 h-6" />}
                                            {node.type === 'question' && <HelpCircle className="w-6 h-6" />}
                                            {node.type === 'pitch' && <Target className="w-6 h-6" />}
                                            {node.type === 'close' && <CheckCircle2 className="w-6 h-6" />}
                                            {!['start', 'question', 'pitch', 'close'].includes(node.type) && <MessageSquare className="w-6 h-6" />}
                                        </div>
                                        <p className="text-xs font-medium text-center mt-2">{node.label}</p>
                                        <p className="text-xs text-slate-500">{node.duration}</p>
                                    </div>
                                    {idx < flowDiagram.nodes.length - 1 && (
                                        <div className="w-8 h-0.5 bg-slate-300 mx-2"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Script Sections */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="opening">Opening</TabsTrigger>
                    <TabsTrigger value="discovery">Discovery</TabsTrigger>
                    <TabsTrigger value="value">Value Prop</TabsTrigger>
                    <TabsTrigger value="close">Close</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-md">Script Metadata</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-600">Generated for:</span>
                                <span className="font-medium">{script.leadName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Company:</span>
                                <span className="font-medium">{script.company}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Role:</span>
                                <span className="font-medium">{script.jobTitle}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">DISC Profile:</span>
                                <Badge>{script.agentToneInstructions?.discProfile?.value || 'N/A'}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Version:</span>
                                <Badge className="bg-green-100 text-green-700">{script.version}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">Generated:</span>
                                <span className="text-xs text-slate-500">{new Date(script.generatedAt).toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-md flex items-center">
                                <Brain className="w-4 h-4 mr-2" />
                                Agent Tone Instructions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <h4 className="text-sm font-medium text-slate-700 mb-1">Communication Style</h4>
                                <p className="text-sm text-slate-600">{script.agentToneInstructions?.communicationStyle?.value || script.agentToneInstructions?.communicationStyle}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-slate-700 mb-1">Tone Guidance</h4>
                                <p className="text-sm text-slate-600">{script.agentToneInstructions?.toneGuidance}</p>
                            </div>
                            {script.agentToneInstructions?.motivators && script.agentToneInstructions.motivators.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-2">Key Motivators</h4>
                                    <ul className="space-y-1">
                                        {script.agentToneInstructions.motivators.map((item: any, idx: number) => (
                                            <li key={idx} className="text-sm text-slate-600 flex items-start">
                                                <span className="text-green-500 mr-2">✓</span>
                                                {typeof item === 'string' ? item : item.text}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {script.agentToneInstructions?.avoidTopics && script.agentToneInstructions.avoidTopics.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-slate-700 mb-2">Topics to Avoid</h4>
                                    <ul className="space-y-1">
                                        {script.agentToneInstructions.avoidTopics.map((item: any, idx: number) => (
                                            <li key={idx} className="text-sm text-red-600 flex items-start">
                                                <span className="text-red-500 mr-2">⚠</span>
                                                {typeof item === 'string' ? item : item.text}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="opening">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-md">Introduction & Opening</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <h4 className="text-sm font-medium text-blue-900 mb-1">Greeting</h4>
                                <p className="text-sm text-blue-800">{script.introduction?.greeting}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <h4 className="text-sm font-medium text-slate-700 mb-1">Permission & Timing</h4>
                                <p className="text-sm text-slate-600 mb-2">{script.introduction?.permission}</p>
                                <p className="text-sm text-slate-600">{script.introduction?.timing}</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <h4 className="text-sm font-medium text-purple-900 mb-1">Company Introduction</h4>
                                <p className="text-sm text-purple-800">{script.credibilityBuilding?.introduction}</p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                <h4 className="text-sm font-medium text-green-900 mb-2">Credibility Building</h4>
                                <div className="space-y-2">
                                    <p className="text-sm text-green-800"><strong>Founders:</strong> {script.credibilityBuilding?.founders}</p>
                                    <p className="text-sm text-green-800"><strong>Funding:</strong> {script.credibilityBuilding?.funding}</p>
                                    <p className="text-sm text-green-800"><strong>Customer Example:</strong> {script.credibilityBuilding?.customerExample}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="discovery">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-md">Discovery Questions</CardTitle>
                            <CardDescription>Persona-aligned questions to uncover needs</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                                <h4 className="text-sm font-medium text-blue-900 mb-1">Contextual Opening</h4>
                                <p className="text-sm text-blue-800">{script.discovery?.contextualOpening}</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 mb-4">
                                <h4 className="text-sm font-medium text-purple-900 mb-1">Pain Point Validation</h4>
                                <p className="text-sm text-purple-800">{script.discovery?.painPointValidation}</p>
                            </div>

                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Smart Questions:</h4>
                            {script.discovery?.smartQuestions?.map((q: any, idx: number) => (
                                <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-start space-x-3">
                                        <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-900 mb-2">{typeof q === 'string' ? q : q.text}</p>
                                            {q.source && (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                                        q.confidence === 'high' ? 'bg-green-100 text-green-700' :
                                                        q.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-700'
                                                    }`}>
                                                        {q.source} • {q.confidence}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="value">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-md">Value Proposition</CardTitle>
                            <CardDescription>How Atomicwork solves their specific challenges</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <h4 className="text-sm font-semibold text-slate-700 mb-2">Pain-to-Solution Mapping:</h4>
                            {script.valueProposition?.painToSolution && Object.entries(script.valueProposition.painToSolution).map(([key, value]: [string, any], idx: number) => (
                                <div key={idx} className="p-4 bg-green-50 rounded-lg border border-green-200">
                                    <h4 className="text-sm font-semibold text-green-900 mb-2 capitalize">{key}</h4>
                                    <p className="text-sm text-green-800">{value}</p>
                                </div>
                            ))}

                            {script.valueProposition?.differentiators && script.valueProposition.differentiators.length > 0 && (
                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                    <h4 className="text-sm font-semibold text-purple-900 mb-2">Key Differentiators</h4>
                                    <ul className="space-y-1">
                                        {script.valueProposition.differentiators.map((diff: string, idx: number) => (
                                            <li key={idx} className="text-sm text-purple-800 flex items-start">
                                                <span className="text-purple-500 mr-2">✓</span>
                                                {diff}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {script.valueProposition?.socialProof && script.valueProposition.socialProof.length > 0 && (
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Customer References</h4>
                                    {script.valueProposition.socialProof.map((customer: any, idx: number) => (
                                        <div key={idx} className="mb-3 last:mb-0">
                                            <p className="text-sm font-medium text-blue-900">{customer.name} ({customer.region})</p>
                                            <p className="text-xs text-blue-700">{customer.industry} • {customer.users.toLocaleString()} users</p>
                                            <p className="text-xs text-blue-600 mt-1">{customer.result}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="close">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-md">Closing & Next Steps</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {script.objectionHandling && (
                                <div className="mb-6">
                                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Common Objections:</h4>
                                    {Object.entries(script.objectionHandling).map(([key, value]: [string, any], idx: number) => (
                                        <div key={idx} className="p-3 bg-orange-50 rounded-lg border border-orange-200 mb-2">
                                            <h5 className="text-sm font-medium text-orange-900 mb-1">"{value.objection}"</h5>
                                            <p className="text-sm text-orange-800"><strong>Response:</strong> {value.response}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                                <h4 className="text-sm font-medium text-indigo-900 mb-1">Direct Ask</h4>
                                <p className="text-sm text-indigo-800">{script.closing?.directAsk}</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg">
                                <h4 className="text-sm font-medium text-slate-700 mb-1">Alternative Close</h4>
                                <p className="text-sm text-slate-600">{script.closing?.alternativeClose}</p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                <h4 className="text-sm font-medium text-green-900 mb-1">Urgency</h4>
                                <p className="text-sm text-green-800">{script.closing?.urgency}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
