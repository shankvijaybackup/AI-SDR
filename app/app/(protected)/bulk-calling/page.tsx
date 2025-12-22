'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Phone,
    PhoneOff,
    Pause,
    Play,
    Users,
    FileText,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    ChevronDown,
    ChevronUp,
    BarChart3
} from 'lucide-react'

interface Lead {
    id: string
    firstName: string
    lastName: string
    phone: string
    email?: string
    company?: string
    jobTitle?: string
}

interface Script {
    id: string
    name: string
    content: string
    isDefault: boolean
}

interface Campaign {
    id: string
    name: string
    status: string
    totalLeads: number
    completedCalls: number
    successfulCalls: number
    failedCalls: number
    currentLeadIndex: number
    script: { name: string }
    createdAt: string
    completedAt?: string
}

interface CallResult {
    id: string
    status: string
    duration?: number
    transcript: any[]
    aiSummary?: string
    interestLevel?: string
    outcome?: string
    createdAt: string
    lead: {
        id: string
        firstName: string
        lastName: string
        company?: string
        phone: string
    }
}

type ViewMode = 'create' | 'campaigns' | 'details'

export default function BulkCallingPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('create')
    const [leads, setLeads] = useState<Lead[]>([])
    const [scripts, setScripts] = useState<Script[]>([])
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
    const [selectedScript, setSelectedScript] = useState<Script | null>(null)
    const [campaignName, setCampaignName] = useState('')
    const [delayBetweenCalls, setDelayBetweenCalls] = useState(5)
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
    const [campaignCalls, setCampaignCalls] = useState<CallResult[]>([])
    const [expandedCall, setExpandedCall] = useState<string | null>(null)

    useEffect(() => {
        fetchLeads()
        fetchScripts()
        fetchCampaigns()
    }, [])

    // Poll for campaign updates when viewing details
    useEffect(() => {
        if (selectedCampaign && selectedCampaign.status === 'running') {
            const interval = setInterval(() => {
                fetchCampaignDetails(selectedCampaign.id)
            }, 3000)
            return () => clearInterval(interval)
        }
    }, [selectedCampaign])

    const fetchLeads = async () => {
        try {
            const response = await fetch('/api/leads')
            if (response.ok) {
                const data = await response.json()
                const callableLeads = data.leads.filter((lead: Lead) => lead.phone?.length > 0)
                setLeads(callableLeads)
            }
        } catch (error) {
            console.error('Failed to fetch leads:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchScripts = async () => {
        try {
            const response = await fetch('/api/scripts')
            if (response.ok) {
                const data = await response.json()
                setScripts(data.scripts)
                const defaultScript = data.scripts.find((s: Script) => s.isDefault)
                if (defaultScript) setSelectedScript(defaultScript)
            }
        } catch (error) {
            console.error('Failed to fetch scripts:', error)
        }
    }

    const fetchCampaigns = async () => {
        try {
            const response = await fetch('/api/calls/bulk')
            if (response.ok) {
                const data = await response.json()
                setCampaigns(data.campaigns)
            }
        } catch (error) {
            console.error('Failed to fetch campaigns:', error)
        }
    }

    const fetchCampaignDetails = async (campaignId: string) => {
        try {
            const response = await fetch(`/api/calls/bulk/${campaignId}`)
            if (response.ok) {
                const data = await response.json()
                setSelectedCampaign(data.campaign)
                setCampaignCalls(data.calls)
            }
        } catch (error) {
            console.error('Failed to fetch campaign details:', error)
        }
    }

    const handleLeadToggle = (leadId: string) => {
        const newSelected = new Set(selectedLeads)
        if (newSelected.has(leadId)) {
            newSelected.delete(leadId)
        } else {
            newSelected.add(leadId)
        }
        setSelectedLeads(newSelected)
    }

    const handleSelectAll = () => {
        if (selectedLeads.size === leads.length) {
            setSelectedLeads(new Set())
        } else {
            setSelectedLeads(new Set(leads.map(l => l.id)))
        }
    }

    const handleCreateCampaign = async () => {
        if (!selectedScript || selectedLeads.size === 0 || !campaignName.trim()) {
            alert('Please provide a campaign name, select a script, and choose at least one lead')
            return
        }

        setCreating(true)
        try {
            const response = await fetch('/api/calls/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: campaignName,
                    scriptId: selectedScript.id,
                    leadIds: Array.from(selectedLeads),
                    delayBetweenCalls,
                }),
            })

            if (response.ok) {
                const data = await response.json()
                setCampaignName('')
                setSelectedLeads(new Set())
                fetchCampaigns()
                fetchCampaignDetails(data.campaignId)
                setViewMode('details')
            } else {
                const error = await response.json()
                alert(error.error || 'Failed to create campaign')
            }
        } catch (error) {
            console.error('Failed to create campaign:', error)
            alert('Failed to create campaign')
        } finally {
            setCreating(false)
        }
    }

    const handleCampaignAction = async (campaignId: string, action: 'pause' | 'resume' | 'cancel') => {
        try {
            const response = await fetch(`/api/calls/bulk/${campaignId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            })

            if (response.ok) {
                fetchCampaigns()
                if (selectedCampaign?.id === campaignId) {
                    fetchCampaignDetails(campaignId)
                }
            }
        } catch (error) {
            console.error('Failed to update campaign:', error)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'text-green-600 bg-green-100'
            case 'paused': return 'text-yellow-600 bg-yellow-100'
            case 'completed': return 'text-blue-600 bg-blue-100'
            case 'cancelled': return 'text-red-600 bg-red-100'
            default: return 'text-slate-600 bg-slate-100'
        }
    }

    const getCallStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-600" />
            case 'failed': case 'busy': case 'no-answer': return <XCircle className="w-4 h-4 text-red-600" />
            case 'calling': case 'in-progress': return <Phone className="w-4 h-4 text-blue-600 animate-pulse" />
            default: return <Clock className="w-4 h-4 text-slate-400" />
        }
    }

    // Campaign Details View
    if (viewMode === 'details' && selectedCampaign) {
        const progress = selectedCampaign.totalLeads > 0
            ? (selectedCampaign.completedCalls / selectedCampaign.totalLeads) * 100
            : 0

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">{selectedCampaign.name}</h1>
                        <p className="text-slate-500 mt-1">Campaign Progress</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Button variant="outline" onClick={() => { setSelectedCampaign(null); setViewMode('campaigns'); }}>
                            ← Back to Campaigns
                        </Button>
                        {selectedCampaign.status === 'running' && (
                            <Button variant="outline" onClick={() => handleCampaignAction(selectedCampaign.id, 'pause')}>
                                <Pause className="w-4 h-4 mr-2" /> Pause
                            </Button>
                        )}
                        {selectedCampaign.status === 'paused' && (
                            <Button onClick={() => handleCampaignAction(selectedCampaign.id, 'resume')}>
                                <Play className="w-4 h-4 mr-2" /> Resume
                            </Button>
                        )}
                        {['running', 'paused'].includes(selectedCampaign.status) && (
                            <Button variant="destructive" onClick={() => handleCampaignAction(selectedCampaign.id, 'cancel')}>
                                <PhoneOff className="w-4 h-4 mr-2" /> Cancel
                            </Button>
                        )}
                    </div>
                </div>

                {/* Progress Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">Status</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCampaign.status)}`}>
                                    {selectedCampaign.status.toUpperCase()}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{selectedCampaign.completedCalls}/{selectedCampaign.totalLeads}</div>
                            <p className="text-sm text-slate-500">Calls Completed</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-green-600">{selectedCampaign.successfulCalls}</div>
                            <p className="text-sm text-slate-500">Successful</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-red-600">{selectedCampaign.failedCalls}</div>
                            <p className="text-sm text-slate-500">Failed</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Progress Bar */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Progress</span>
                            <span className="text-sm text-slate-500">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3">
                            <div
                                className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Call Results */}
                <Card>
                    <CardHeader>
                        <CardTitle>Call Results</CardTitle>
                        <CardDescription>Individual call details with transcripts and AI analysis</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {campaignCalls.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    {selectedCampaign.status === 'running' ? (
                                        <div className="flex items-center justify-center space-x-2">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Waiting for first call to complete...</span>
                                        </div>
                                    ) : (
                                        'No calls made yet'
                                    )}
                                </div>
                            ) : (
                                campaignCalls.map((call) => (
                                    <div
                                        key={call.id}
                                        className="border rounded-lg overflow-hidden"
                                    >
                                        <div
                                            className="p-4 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100"
                                            onClick={() => setExpandedCall(expandedCall === call.id ? null : call.id)}
                                        >
                                            <div className="flex items-center space-x-3">
                                                {getCallStatusIcon(call.status)}
                                                <div>
                                                    <p className="font-medium">{call.lead.firstName} {call.lead.lastName}</p>
                                                    <p className="text-sm text-slate-500">{call.lead.company} • {call.lead.phone}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                {call.interestLevel && (
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${call.interestLevel === 'high' ? 'bg-green-100 text-green-700' :
                                                            call.interestLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-slate-100 text-slate-700'
                                                        }`}>
                                                        {call.interestLevel} interest
                                                    </span>
                                                )}
                                                {call.duration && (
                                                    <span className="text-sm text-slate-500">{Math.floor(call.duration / 60)}:{String(call.duration % 60).padStart(2, '0')}</span>
                                                )}
                                                {expandedCall === call.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </div>
                                        </div>

                                        {expandedCall === call.id && (
                                            <div className="p-4 border-t space-y-4">
                                                {/* AI Summary */}
                                                {call.aiSummary && (
                                                    <div className="bg-blue-50 p-3 rounded-lg">
                                                        <h4 className="font-medium text-blue-900 mb-1">AI Analysis</h4>
                                                        <p className="text-sm text-blue-800">{call.aiSummary}</p>
                                                    </div>
                                                )}

                                                {/* Transcript */}
                                                <div>
                                                    <h4 className="font-medium mb-2">Transcript</h4>
                                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                                        {Array.isArray(call.transcript) && call.transcript.length > 0 ? (
                                                            call.transcript.map((entry: any, idx: number) => (
                                                                <div
                                                                    key={idx}
                                                                    className={`p-2 rounded text-sm ${entry.speaker === 'agent' ? 'bg-blue-50 ml-4' : 'bg-slate-50 mr-4'
                                                                        }`}
                                                                >
                                                                    <span className="font-medium text-xs text-slate-500">
                                                                        {entry.speaker === 'agent' ? 'AI' : 'Prospect'}:
                                                                    </span>
                                                                    <p>{entry.text}</p>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <p className="text-sm text-slate-500">No transcript available</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Campaigns List View
    if (viewMode === 'campaigns') {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Bulk Campaigns</h1>
                        <p className="text-slate-500 mt-1">View and manage your calling campaigns</p>
                    </div>
                    <Button onClick={() => setViewMode('create')}>
                        <Phone className="w-4 h-4 mr-2" /> New Campaign
                    </Button>
                </div>

                {campaigns.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-700">No campaigns yet</h3>
                            <p className="text-slate-500 mt-1">Create your first bulk calling campaign</p>
                            <Button className="mt-4" onClick={() => setViewMode('create')}>
                                Create Campaign
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {campaigns.map((campaign) => (
                            <Card key={campaign.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedCampaign(campaign); fetchCampaignDetails(campaign.id); setViewMode('details'); }}>
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium text-lg">{campaign.name}</h3>
                                            <p className="text-sm text-slate-500">
                                                {campaign.script?.name} • {campaign.totalLeads} leads
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <div className="text-right">
                                                <p className="text-sm font-medium">{campaign.completedCalls}/{campaign.totalLeads} calls</p>
                                                <p className="text-xs text-slate-500">
                                                    {campaign.successfulCalls} successful, {campaign.failedCalls} failed
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                                                {campaign.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // Create Campaign View
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Create Bulk Campaign</h1>
                    <p className="text-slate-500 mt-1">Select leads and start automated calling</p>
                </div>
                <Button variant="outline" onClick={() => setViewMode('campaigns')}>
                    <BarChart3 className="w-4 h-4 mr-2" /> View Campaigns
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Campaign Settings */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Campaign Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="campaignName">Campaign Name</Label>
                            <Input
                                id="campaignName"
                                placeholder="e.g., Q4 Outreach"
                                value={campaignName}
                                onChange={(e) => setCampaignName(e.target.value)}
                            />
                        </div>

                        <div>
                            <Label>Script</Label>
                            <div className="space-y-2 mt-2">
                                {scripts.map((script) => (
                                    <div
                                        key={script.id}
                                        onClick={() => setSelectedScript(script)}
                                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedScript?.id === script.id
                                                ? 'border-blue-600 bg-blue-50'
                                                : 'hover:border-slate-300'
                                            }`}
                                    >
                                        <p className="font-medium text-sm">{script.name}</p>
                                        {script.isDefault && (
                                            <span className="text-xs text-blue-600">Default</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="delay">Delay Between Calls (seconds)</Label>
                            <Input
                                id="delay"
                                type="number"
                                min={0}
                                max={60}
                                value={delayBetweenCalls}
                                onChange={(e) => setDelayBetweenCalls(parseInt(e.target.value) || 5)}
                            />
                            <p className="text-xs text-slate-500 mt-1">Wait time after each call completes</p>
                        </div>

                        <div className="pt-4 border-t">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-slate-600">Selected leads:</span>
                                <span className="font-medium">{selectedLeads.size} / {leads.length}</span>
                            </div>
                            <Button
                                className="w-full"
                                disabled={selectedLeads.size === 0 || !selectedScript || !campaignName.trim() || creating}
                                onClick={handleCreateCampaign}
                            >
                                {creating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Starting...
                                    </>
                                ) : (
                                    <>
                                        <Phone className="w-4 h-4 mr-2" />
                                        Start Campaign
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Lead Selection */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Select Leads</CardTitle>
                                <CardDescription>Choose leads to include in this campaign</CardDescription>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleSelectAll}>
                                {selectedLeads.size === leads.length ? 'Deselect All' : 'Select All'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                            </div>
                        ) : leads.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500">No leads with phone numbers available</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {leads.map((lead) => (
                                    <div
                                        key={lead.id}
                                        onClick={() => handleLeadToggle(lead.id)}
                                        className={`p-3 border rounded-lg cursor-pointer transition-colors flex items-center ${selectedLeads.has(lead.id)
                                                ? 'border-blue-600 bg-blue-50'
                                                : 'hover:border-slate-300'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${selectedLeads.has(lead.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                                            }`}>
                                            {selectedLeads.has(lead.id) && (
                                                <CheckCircle2 className="w-4 h-4 text-white" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                                            <p className="text-sm text-slate-500">{lead.company} • {lead.jobTitle}</p>
                                        </div>
                                        <p className="text-sm text-slate-400">{lead.phone}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
