'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Phone, PhoneOff, Mic } from 'lucide-react'
import { CallStatusBadge } from './call-status-badge'

interface Lead {
    id: string
    firstName: string
    lastName: string
    phone: string
    company?: string
    jobTitle?: string
    linkedinUrl?: string
    linkedinEnriched?: boolean
}

interface Script {
    id: string
    name: string
    isDefault?: boolean
}

interface QuickCallModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    lead: Lead | null
    onCallComplete?: () => void
}

export function QuickCallModal({ open, onOpenChange, lead, onCallComplete }: QuickCallModalProps) {
    const [scripts, setScripts] = useState<Script[]>([])
    const [selectedScript, setSelectedScript] = useState<Script | null>(null)
    const [callStatus, setCallStatus] = useState<'idle' | 'preparing' | 'ringing' | 'in-progress' | 'ended'>('idle')
    const [realTimeStatus, setRealTimeStatus] = useState('idle')
    const [currentCallId, setCurrentCallId] = useState<string | null>(null)
    const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([])
    const [logs, setLogs] = useState<string[]>([])

    useEffect(() => {
        if (open) {
            fetchScripts()
            // Reset state when opening
            setCallStatus('idle')
            setRealTimeStatus('idle')
            setTranscript([])
            setLogs([])
            setCurrentCallId(null)
        }
    }, [open])

    const fetchScripts = async () => {
        try {
            const response = await fetch('/api/scripts')
            if (response.ok) {
                const data = await response.json()
                setScripts(data.scripts || [])
                const defaultScript = data.scripts?.find((s: Script) => s.isDefault)
                if (defaultScript) setSelectedScript(defaultScript)
            }
        } catch (error) {
            console.error('Failed to fetch scripts:', error)
        }
    }

    const handleStartCall = async () => {
        if (!lead || !selectedScript) return

        setCallStatus('preparing')
        setRealTimeStatus('preparing')
        setLogs(['[Initiate Call] Starting call...'])

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
            const response = await fetch(`${backendUrl}/api/twilio/initiate-call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId: lead.id,
                    scriptId: selectedScript.id,
                    leadName: `${lead.firstName} ${lead.lastName}`,
                    leadPhone: lead.phone,
                    leadCompany: lead.company,
                    leadJobTitle: lead.jobTitle,
                }),
            })

            if (!response.ok) throw new Error('Failed to initiate call')

            const data = await response.json()
            setCurrentCallId(data.callId)
            setCallStatus('ringing')
            setRealTimeStatus('ringing')
            setLogs(prev => [...prev, `[Call] Created: ${data.callId.substring(0, 8)}...`])

            // Start polling
            pollCallStatus(data.callId)
        } catch (error) {
            console.error('Call failed:', error)
            setCallStatus('ended')
            setRealTimeStatus('failed')
            setLogs(prev => [...prev, '[Error] Failed to start call'])
        }
    }

    const pollCallStatus = async (callId: string) => {
        const pollInterval = setInterval(async () => {
            try {
                const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
                const response = await fetch(`${backendUrl}/api/calls/${callId}/status`)

                if (response.ok) {
                    const data = await response.json()

                    // Update status
                    if (data.status) {
                        setRealTimeStatus(data.status)
                    }

                    // Update transcript
                    if (data.transcript && data.transcript.length > transcript.length) {
                        setTranscript(data.transcript)
                    }

                    // Check if ended
                    const endedStatuses = ['completed', 'failed', 'voicemail', 'no-answer', 'busy', 'canceled']
                    if (endedStatuses.includes(data.status)) {
                        clearInterval(pollInterval)
                        setCallStatus('ended')
                        setLogs(prev => [...prev, `[Call End] ${data.disconnectReason || data.status}`])
                    } else if (data.status === 'in-progress' || data.status === 'answered') {
                        setCallStatus('in-progress')
                    }
                }
            } catch (error) {
                console.error('Poll error:', error)
            }
        }, 2000)
    }

    const handleEndCall = () => {
        setCallStatus('ended')
        if (onCallComplete) onCallComplete()
    }

    const handleClose = () => {
        if (callStatus !== 'preparing' && callStatus !== 'ringing' && callStatus !== 'in-progress') {
            onOpenChange(false)
        }
    }

    if (!lead) return null

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-green-600" />
                            Quick Call
                        </DialogTitle>
                        <CallStatusBadge status={realTimeStatus as any} />
                    </div>
                </DialogHeader>

                {/* Lead Info */}
                <div className="p-3 bg-slate-50 rounded-lg">
                    <h3 className="font-semibold">{lead.firstName} {lead.lastName}</h3>
                    <p className="text-sm text-slate-500">{lead.company} • {lead.jobTitle}</p>
                    <p className="text-sm font-medium mt-1">📞 {lead.phone}</p>
                </div>

                {/* Script Selection (only when idle) */}
                {callStatus === 'idle' && (
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Select Script</label>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                            {scripts.map((script) => (
                                <div
                                    key={script.id}
                                    onClick={() => setSelectedScript(script)}
                                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedScript?.id === script.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                >
                                    <span className="text-sm font-medium">{script.name}</span>
                                    {script.isDefault && (
                                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Default</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Live Transcript (during call) */}
                {(callStatus === 'ringing' || callStatus === 'in-progress') && (
                    <Card>
                        <CardContent className="p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Mic className="w-4 h-4 text-red-500 animate-pulse" />
                                <span className="text-sm font-medium">Live Transcript</span>
                            </div>
                            <div className="max-h-32 overflow-y-auto text-sm space-y-1">
                                {transcript.length === 0 ? (
                                    <p className="text-slate-400 italic">Waiting for conversation...</p>
                                ) : (
                                    transcript.map((entry, i) => (
                                        <p key={i} className={entry.speaker === 'agent' ? 'text-blue-600' : 'text-slate-700'}>
                                            <strong>{entry.speaker === 'agent' ? 'AI:' : 'Lead:'}</strong> {entry.text}
                                        </p>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Logs */}
                {logs.length > 0 && (
                    <div className="text-xs bg-slate-900 text-green-400 p-2 rounded font-mono max-h-20 overflow-y-auto">
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    {callStatus === 'idle' && (
                        <>
                            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                                onClick={handleStartCall}
                                disabled={!selectedScript}
                            >
                                <Phone className="w-4 h-4 mr-2" />
                                Start Call
                            </Button>
                        </>
                    )}

                    {(callStatus === 'ringing' || callStatus === 'in-progress') && (
                        <Button variant="destructive" className="w-full" onClick={handleEndCall}>
                            <PhoneOff className="w-4 h-4 mr-2" />
                            End Call
                        </Button>
                    )}

                    {callStatus === 'ended' && (
                        <Button className="w-full" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
