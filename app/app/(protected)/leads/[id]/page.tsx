'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    ArrowLeft,
    Phone,
    Mail,
    Building2,
    Briefcase,
    Linkedin,
    Clock,
    AlertCircle,
    CheckCircle,
    XCircle,
    Voicemail,
    PhoneOff,
    MessageSquare,
    TrendingUp
} from 'lucide-react'
import { format } from 'date-fns'

interface Lead {
    id: string
    firstName: string
    lastName: string
    phone: string
    email?: string
    company?: string
    jobTitle?: string
    linkedinUrl?: string
    linkedinEnriched: boolean
    linkedinData?: any
    status: string
    interestLevel?: string
    notes?: string
    createdAt: string
    updatedAt: string
}

interface Call {
    id: string
    status: string
    disconnectReason?: string
    duration: number | null
    transcript: any[]
    aiSummary: string | null
    interestLevel: string | null
    outcome?: string
    createdAt: string
    script: {
        name: string
    } | null
}

export default function LeadDetailPage() {
    const params = useParams()
    const router = useRouter()
    const leadId = params.id as string

    const [lead, setLead] = useState<Lead | null>(null)
    const [calls, setCalls] = useState<Call[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCall, setSelectedCall] = useState<Call | null>(null)

    useEffect(() => {
        if (leadId) {
            fetchLeadData()
            fetchCallHistory()
        }
    }, [leadId])

    const fetchLeadData = async () => {
        try {
            const response = await fetch(`/api/leads/${leadId}`)
            if (response.ok) {
                const data = await response.json()
                setLead(data.lead)
            }
        } catch (error) {
            console.error('Failed to fetch lead:', error)
        }
    }

    const fetchCallHistory = async () => {
        try {
            const response = await fetch(`/api/calls/history/${leadId}`)
            if (response.ok) {
                const data = await response.json()
                setCalls(data.calls)
            }
        } catch (error) {
            console.error('Failed to fetch call history:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusIcon = (status: string, disconnectReason?: string) => {
        if (disconnectReason?.includes('Voicemail') || status === 'voicemail') {
            return <Voicemail className="w-4 h-4 text-amber-500" />
        }
        if (status === 'no-answer' || disconnectReason?.includes('No answer')) {
            return <PhoneOff className="w-4 h-4 text-orange-500" />
        }
        if (status === 'busy') {
            return <XCircle className="w-4 h-4 text-red-500" />
        }
        if (status === 'failed') {
            return <AlertCircle className="w-4 h-4 text-red-500" />
        }
        if (status === 'completed') {
            return <CheckCircle className="w-4 h-4 text-green-500" />
        }
        return <Phone className="w-4 h-4 text-blue-500" />
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            'completed': 'bg-green-100 text-green-800',
            'voicemail': 'bg-amber-100 text-amber-800',
            'no-answer': 'bg-orange-100 text-orange-800',
            'busy': 'bg-red-100 text-red-800',
            'failed': 'bg-red-100 text-red-800',
            'initiated': 'bg-blue-100 text-blue-800',
        }
        return styles[status] || 'bg-slate-100 text-slate-800'
    }

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return 'N/A'
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}m ${secs}s`
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    if (!lead) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Lead not found</p>
                <Button className="mt-4" onClick={() => router.push('/leads')}>
                    Back to Leads
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/leads')}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {lead.firstName} {lead.lastName}
                        </h1>
                        <p className="text-slate-500">{lead.company}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${lead.status === 'qualified' ? 'bg-green-100 text-green-800' :
                            lead.status === 'contacted' ? 'bg-blue-100 text-blue-800' :
                                lead.status === 'not_interested' ? 'bg-red-100 text-red-800' :
                                    'bg-slate-100 text-slate-800'
                        }`}>
                        {lead.status}
                    </span>
                    <Button onClick={() => router.push('/calling')}>
                        <Phone className="w-4 h-4 mr-2" />
                        Call
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lead Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-3">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                                {lead.phone}
                            </a>
                        </div>
                        {lead.email && (
                            <div className="flex items-center space-x-3">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                                    {lead.email}
                                </a>
                            </div>
                        )}
                        {lead.company && (
                            <div className="flex items-center space-x-3">
                                <Building2 className="w-4 h-4 text-slate-400" />
                                <span>{lead.company}</span>
                            </div>
                        )}
                        {lead.jobTitle && (
                            <div className="flex items-center space-x-3">
                                <Briefcase className="w-4 h-4 text-slate-400" />
                                <span>{lead.jobTitle}</span>
                            </div>
                        )}
                        {lead.linkedinUrl && (
                            <div className="flex items-center space-x-3">
                                <Linkedin className="w-4 h-4 text-blue-600" />
                                <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline">
                                    View Profile
                                </a>
                                {lead.linkedinEnriched && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                        Enriched
                                    </span>
                                )}
                            </div>
                        )}
                        {lead.notes && (
                            <div className="pt-4 border-t">
                                <p className="text-sm text-slate-600">{lead.notes}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Activity Timeline */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Activity Timeline</CardTitle>
                        <CardDescription>All calls and interactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {calls.length === 0 ? (
                            <div className="text-center py-8">
                                <Phone className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500">No calls yet</p>
                                <Button className="mt-4" onClick={() => router.push('/calling')}>
                                    Make First Call
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {calls.map((call) => (
                                    <div
                                        key={call.id}
                                        onClick={() => setSelectedCall(selectedCall?.id === call.id ? null : call)}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedCall?.id === call.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        {/* Call Header */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                {getStatusIcon(call.status, call.disconnectReason)}
                                                <div>
                                                    <p className="font-medium text-sm">
                                                        {call.script?.name || 'Call'}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {format(new Date(call.createdAt), 'MMM d, yyyy h:mm a')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(call.status)}`}>
                                                    {call.status}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    {formatDuration(call.duration)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Disconnect Reason */}
                                        {call.disconnectReason && (
                                            <div className="mt-2 flex items-center space-x-2 text-sm text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                                <AlertCircle className="w-3 h-3" />
                                                <span>{call.disconnectReason}</span>
                                            </div>
                                        )}

                                        {/* AI Summary Preview */}
                                        {call.aiSummary && (
                                            <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                                                {call.aiSummary}
                                            </p>
                                        )}

                                        {/* Expanded Details */}
                                        {selectedCall?.id === call.id && (
                                            <div className="mt-4 pt-4 border-t space-y-4">
                                                {/* Interest Level */}
                                                {call.interestLevel && (
                                                    <div className="flex items-center space-x-2">
                                                        <TrendingUp className="w-4 h-4 text-slate-400" />
                                                        <span className="text-sm font-medium">Interest:</span>
                                                        <span className={`px-2 py-0.5 rounded text-xs ${call.interestLevel === 'high' ? 'bg-green-100 text-green-800' :
                                                                call.interestLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-slate-100 text-slate-800'
                                                            }`}>
                                                            {call.interestLevel}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Full Summary */}
                                                {call.aiSummary && (
                                                    <div>
                                                        <h4 className="text-sm font-medium mb-1 flex items-center">
                                                            <MessageSquare className="w-4 h-4 mr-1" />
                                                            AI Summary
                                                        </h4>
                                                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
                                                            {call.aiSummary}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Transcript */}
                                                {call.transcript && call.transcript.length > 0 && (
                                                    <div>
                                                        <h4 className="text-sm font-medium mb-2">Transcript</h4>
                                                        <div className="space-y-2 bg-slate-50 p-3 rounded max-h-64 overflow-y-auto">
                                                            {call.transcript.map((entry: any, idx: number) => (
                                                                <div key={idx} className="text-sm">
                                                                    <span className={`font-medium ${entry.speaker === 'agent' ? 'text-blue-600' : 'text-slate-700'
                                                                        }`}>
                                                                        {entry.speaker === 'agent' ? 'AI' : 'Lead'}:
                                                                    </span>
                                                                    <span className="text-slate-600 ml-2">{entry.text}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-slate-900">{calls.length}</p>
                            <p className="text-sm text-slate-500">Total Calls</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">
                                {calls.filter(c => c.status === 'completed' && c.duration && c.duration > 0).length}
                            </p>
                            <p className="text-sm text-slate-500">Connected</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-amber-600">
                                {calls.filter(c => c.status === 'voicemail' || c.disconnectReason?.includes('Voicemail')).length}
                            </p>
                            <p className="text-sm text-slate-500">Voicemails</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-orange-600">
                                {calls.filter(c => c.status === 'no-answer' || c.disconnectReason?.includes('No answer')).length}
                            </p>
                            <p className="text-sm text-slate-500">No Answer</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
