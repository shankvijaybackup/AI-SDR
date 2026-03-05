'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Phone, PhoneOff, Mic, FileText, Sparkles, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { CallStatusBadge } from './call-status-badge'

interface Lead {
    id: string
    firstName: string
    lastName: string
    email?: string
    phone: string
    company?: string
    jobTitle?: string
    linkedinUrl?: string
    linkedinEnriched?: boolean
}

interface Script {
    id: string
    name: string
    content: string
    isDefault?: boolean
    isPersonalized?: boolean
}

interface QuickCallModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    lead: Lead | null
    onCallComplete?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Replace {{variable}} placeholders with actual lead data */
function substituteVariables(content: string, lead: Lead): string {
    return content
        .replace(/\{\{firstName\}\}/g, lead.firstName || '')
        .replace(/\{\{lastName\}\}/g, lead.lastName || '')
        .replace(/\{\{company\}\}/g, lead.company || '')
        .replace(/\{\{jobTitle\}\}/g, lead.jobTitle || '')
        .replace(/\{\{repName\}\}/g, 'Alex')
        .replace(/\{\{companyName\}\}/g, 'Atomicwork')
}

/** Parse a personalized JSON script into a human-readable section list */
function renderPersonalizedScript(raw: string): Array<{ emoji: string; label: string; text: string }> {
    try {
        const s = typeof raw === 'string' ? JSON.parse(raw) : raw
        const sections: Array<{ emoji: string; label: string; text: string }> = []

        // ITSM Playbook structure (from lead-scripts.js backend)
        if (s.opener) {
            const parts = [s.opener.patternInterrupt, s.opener.permission].filter(Boolean)
            sections.push({ emoji: '📞', label: 'Opener', text: parts.join('\n') })
            if (s.opener.waitForResponse) {
                sections.push({ emoji: '⏸️', label: 'Wait For', text: s.opener.waitForResponse })
            }
        }

        if (s.hook) {
            const hParts = [s.hook.problemStatement, s.hook.confirmPain].filter(Boolean)
            sections.push({ emoji: '🎯', label: 'Hook (Pain)', text: hParts.join('\n') })
        }

        if (s.valueDrivers) {
            const vd = s.valueDrivers
            const lines = [
                vd.speed ? `• Speed: ${vd.speed}` : '',
                vd.cost ? `• Cost: ${vd.cost}` : '',
                vd.experience ? `• Experience: ${vd.experience}` : '',
                vd.socialProof ? `• Proof: ${vd.socialProof}` : '',
            ].filter(Boolean)
            sections.push({ emoji: '💡', label: 'Value Drivers', text: lines.join('\n') })
        }

        if (s.ask) {
            const askParts = [s.ask.softClose, s.ask.choiceQuestion].filter(Boolean)
            sections.push({ emoji: '✅', label: 'The Ask', text: askParts.join('\n') })
        }

        if (s.objectionHandling && Object.keys(s.objectionHandling).length > 0) {
            const lines = Object.values(s.objectionHandling as Record<string, any>).map(
                (o: any) => `Q: "${o.objection}"\nA: ${o.response}`
            )
            sections.push({ emoji: '🛡️', label: 'Objections', text: lines.join('\n\n') })
        }

        if (s.gracefulExit) {
            const ge = s.gracefulExit
            const exitLines = [ge.ifTheyDecline, ge.emailOffer, ge.warmClose].filter(Boolean)
            sections.push({ emoji: '👋', label: 'If They Say No', text: exitLines.join('\n') })
        }

        if (s.agentToneInstructions) {
            const t = s.agentToneInstructions
            sections.push({
                emoji: '🎭',
                label: `Tone (DISC: ${t.discProfile || '?'})`,
                text: t.toneGuidance || t.communicationStyle || '',
            })
        }

        // Older JSON format (opening / valueProposition / closing)
        if (sections.length === 0) {
            if (s.opening) {
                sections.push({
                    emoji: '📞', label: 'Opening',
                    text: [s.opening.iceBreaker, s.opening.credibilityStatement, s.opening.purposeStatement].filter(Boolean).join('\n'),
                })
            }
            if (s.valueProposition?.keyMessages?.length) {
                sections.push({
                    emoji: '💡', label: 'Key Messages',
                    text: s.valueProposition.keyMessages.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n'),
                })
            }
            if (s.discovery?.questions?.length) {
                sections.push({
                    emoji: '❓', label: 'Discovery Questions',
                    text: s.discovery.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n'),
                })
            }
            if (s.closing?.directAsk) {
                sections.push({ emoji: '✅', label: 'Close', text: s.closing.directAsk })
            }
        }

        return sections
    } catch {
        return [{ emoji: '📋', label: 'Script', text: 'Personalized script loaded (structured format)' }]
    }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function QuickCallModal({ open, onOpenChange, lead, onCallComplete }: QuickCallModalProps) {
    const [scripts, setScripts] = useState<Script[]>([])
    const [selectedScript, setSelectedScript] = useState<Script | null>(null)
    const [callStatus, setCallStatus] = useState<'idle' | 'preparing' | 'ringing' | 'in-progress' | 'ended'>('idle')
    const [realTimeStatus, setRealTimeStatus] = useState('idle')
    const [currentCallId, setCurrentCallId] = useState<string | null>(null)
    const [transcript, setTranscript] = useState<Array<{ speaker: string; text: string }>>([])
    const [logs, setLogs] = useState<string[]>([])
    const [hasPersonalizedScript, setHasPersonalizedScript] = useState(false)
    const [scriptExpanded, setScriptExpanded] = useState(true)

    useEffect(() => {
        if (open) {
            fetchScripts()
            setCallStatus('idle')
            setRealTimeStatus('idle')
            setTranscript([])
            setLogs([])
            setCurrentCallId(null)
            setScriptExpanded(true)
        }
    }, [open])

    const fetchScripts = async () => {
        try {
            // Priority 1: Lead's personalized generated script
            if (lead?.id) {
                const leadScriptResponse = await fetch(`/api/leads/${lead.id}/script`)
                if (leadScriptResponse.ok) {
                    const leadScriptData = await leadScriptResponse.json()
                    if (leadScriptData.script) {
                        const personalizedScript: Script = {
                            id: `lead-${lead.id}`,
                            name: `🎯 Personalized Script — ${lead.firstName} ${lead.lastName}`,
                            content: JSON.stringify(leadScriptData.script),
                            isDefault: true,
                            isPersonalized: true,
                        }
                        setScripts([personalizedScript])
                        setSelectedScript(personalizedScript)
                        setHasPersonalizedScript(true)
                        return
                    }
                }
            }

            // Fallback: Generic scripts from library
            setHasPersonalizedScript(false)
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
        setScriptExpanded(false)
        setLogs(['[Initiate Call] Starting call...'])

        try {
            const response = await fetch('/api/calls/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId: lead.id,
                    scriptId: selectedScript.id,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
            }

            const data = await response.json()
            setCurrentCallId(data.callId)
            setCallStatus('ringing')
            setRealTimeStatus('ringing')
            setLogs(prev => [...prev, `[Call] Created: ${data.callId.substring(0, 8)}...`])

            pollCallStatus(data.callId)
        } catch (error) {
            console.error('Call failed:', error)
            setCallStatus('ended')
            setRealTimeStatus('failed')
            setLogs(prev => [...prev, `[Error] Failed to start call: ${error instanceof Error ? error.message : String(error)}`])
        }
    }

    const pollCallStatus = async (callId: string) => {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/calls/${callId}`)
                if (response.ok) {
                    const data = await response.json()
                    const callData = data.call

                    if (callData.status) setRealTimeStatus(callData.status)

                    if (callData.transcript && callData.transcript.length > transcript.length) {
                        setTranscript(callData.transcript)
                    }

                    const endedStatuses = ['completed', 'failed', 'voicemail', 'no-answer', 'busy', 'canceled']
                    if (endedStatuses.includes(callData.status)) {
                        clearInterval(pollInterval)
                        setCallStatus('ended')
                        setLogs(prev => [...prev, `[Call End] ${callData.disconnectReason || callData.status}`])
                        if (callData.transcript?.length > 0) setTranscript(callData.transcript)
                    } else if (callData.status === 'in-progress' || callData.status === 'answered') {
                        setCallStatus('in-progress')
                    }
                }
            } catch (error) {
                console.error('Poll error:', error)
            }
        }, 2000)
    }

    const handleEndCall = async () => {
        setCallStatus('ended')
        if (onCallComplete) onCallComplete()
    }

    const handleClose = () => {
        if (callStatus !== 'preparing' && callStatus !== 'ringing' && callStatus !== 'in-progress') {
            onOpenChange(false)
        }
    }

    if (!lead) return null

    // Build the script preview content
    const personalizedSections = selectedScript?.isPersonalized
        ? renderPersonalizedScript(selectedScript.content)
        : null

    const genericRendered = selectedScript && !selectedScript.isPersonalized
        ? substituteVariables(selectedScript.content, lead)
        : null

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <DialogTitle>
                            <div className="flex items-center gap-3">
                                <Phone className="w-5 h-5 text-green-600" />
                                Quick Call
                            </div>
                        </DialogTitle>
                        <CallStatusBadge status={realTimeStatus as any} />
                    </div>
                </DialogHeader>

                {/* Lead Info */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">{lead.firstName} {lead.lastName}</h3>
                            <p className="text-sm text-slate-500">{lead.company} • {lead.jobTitle}</p>
                            <p className="text-sm font-medium mt-1">📞 {lead.phone}</p>
                        </div>
                        {lead.linkedinEnriched && (
                            <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">
                                ✓ Enriched
                            </span>
                        )}
                    </div>
                </div>

                {/* Script Selection + Preview (only when idle) */}
                {callStatus === 'idle' && (
                    <div className="space-y-3">
                        {/* Script selector */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Script</label>

                            {/* No-personalized-script nudge */}
                            {!hasPersonalizedScript && lead.linkedinEnriched && (
                                <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs">
                                    <span className="text-amber-700 dark:text-amber-400">
                                        💡 This lead is enriched — generate a personalized script for better results
                                    </span>
                                    <a
                                        href={`/leads/${lead.id}#script`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium hover:underline ml-2 shrink-0"
                                    >
                                        Generate <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            )}

                            {scripts.length === 0 ? (
                                <div className="p-4 border border-dashed rounded-lg bg-slate-50 text-center">
                                    <p className="text-sm text-slate-500">No scripts found.</p>
                                    <p className="text-xs text-slate-400 mt-1">Add scripts in the Scripts module first.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto">
                                    {scripts.map((script) => (
                                        <div
                                            key={script.id}
                                            onClick={() => setSelectedScript(script)}
                                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedScript?.id === script.id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">{script.name}</span>
                                                <div className="flex items-center gap-1">
                                                    {script.isPersonalized && (
                                                        <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                                                            Personalized
                                                        </span>
                                                    )}
                                                    {script.isDefault && !script.isPersonalized && (
                                                        <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                                                            Default
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Script Preview Panel */}
                        {selectedScript && (
                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                <button
                                    onClick={() => setScriptExpanded(!scriptExpanded)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-500" />
                                        <span>Script Preview</span>
                                        {selectedScript.isPersonalized ? (
                                            <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" /> Personalized for {lead.firstName}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-blue-600 dark:text-blue-400">
                                                Variables filled for {lead.firstName}
                                            </span>
                                        )}
                                    </div>
                                    {scriptExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>

                                {scriptExpanded && (
                                    <div className="p-3 max-h-64 overflow-y-auto bg-white dark:bg-slate-900">
                                        {personalizedSections ? (
                                            // Structured personalized script
                                            <div className="space-y-3">
                                                {personalizedSections.map((section, i) => (
                                                    <div key={i} className="space-y-1">
                                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                            {section.emoji} {section.label}
                                                        </p>
                                                        <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                            {section.text}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            // Generic script with variables substituted
                                            <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                                {genericRendered}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Live Transcript during/after call */}
                {(callStatus === 'ringing' || callStatus === 'in-progress' || callStatus === 'ended') && (
                    <Card className="mt-2">
                        <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {callStatus === 'ended' ? (
                                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                                    ) : (
                                        <Mic className="w-4 h-4 text-red-500 animate-pulse" />
                                    )}
                                    <span className="text-sm font-medium">
                                        {callStatus === 'ended' ? 'Call Transcript' : 'Live Transcript'}
                                    </span>
                                </div>
                                {callStatus === 'ended' && transcript.length > 0 && (
                                    <span className="text-xs text-slate-500">{transcript.length} turns</span>
                                )}
                            </div>
                            <div className="max-h-80 overflow-y-auto text-sm space-y-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700">
                                {transcript.length === 0 ? (
                                    <div className="text-center py-4 text-slate-400 italic">
                                        {callStatus === 'ended' ? 'No transcript available.' : 'Connecting...'}
                                    </div>
                                ) : (
                                    transcript.map((entry, i) => (
                                        <div key={i} className={`flex flex-col ${entry.speaker === 'agent' ? 'items-end' : 'items-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${entry.speaker === 'agent'
                                                ? 'bg-blue-600 text-white rounded-tr-none'
                                                : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 rounded-tl-none'
                                                }`}>
                                                <p>{entry.text}</p>
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-1 px-1">
                                                {entry.speaker === 'agent' ? 'AI Assistant' : lead.firstName}
                                            </span>
                                        </div>
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
