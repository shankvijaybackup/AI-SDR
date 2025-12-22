'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Phone, PhoneOff, Pause, Play, User, FileText, Mic, Volume2, Linkedin } from 'lucide-react'
import { PostCallSummary } from '@/components/post-call-summary'

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
}

interface Script {
  id: string
  name: string
  content: string
  isDefault: boolean
}

type CallStatus = 'idle' | 'preparing' | 'calling' | 'paused' | 'ended'

interface TranscriptEntry {
  speaker: 'rep' | 'lead' | 'ai'
  text: string
  timestamp: Date
}

export default function CallingPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)
  // voicePersona removed - backend auto-selects from voice pool
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [aiPreview, setAiPreview] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [showPostCallSummary, setShowPostCallSummary] = useState(false)
  const [backendLogs, setBackendLogs] = useState<string[]>([])

  useEffect(() => {
    fetchLeads()
    fetchScripts()
  }, [])

  const fetchLeads = async () => {
    try {
      // Fetch all leads
      const response = await fetch('/api/leads')
      if (response.ok) {
        const data = await response.json()
        // Show all leads - calling page will indicate if phone is missing
        setLeads(data.leads)
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

  const handleStartCall = async () => {
    if (!selectedLead || !selectedScript) return

    setCallStatus('preparing')
    setBackendLogs([
      '[Initiate Call] Starting call...',
      `[Script] Using: ${selectedScript.name}`,
      `[Voice] Auto-selected from pool (Arabella, Anika, Brandon, Adam, Jane)`
    ])

    try {
      // Enrich lead with LinkedIn data if available and not already enriched
      if (selectedLead.linkedinUrl && !selectedLead.linkedinEnriched) {
        setBackendLogs(prev => [...prev, '[LinkedIn] Enriching lead profile...'])
        try {
          const enrichResponse = await fetch(`/api/leads/${selectedLead.id}/enrich`, {
            method: 'POST',
          })
          if (enrichResponse.ok) {
            setBackendLogs(prev => [...prev, '[LinkedIn] ✓ Profile enriched successfully'])
            // Refresh lead data
            const leadResponse = await fetch(`/api/leads?status=pending`)
            if (leadResponse.ok) {
              const data = await leadResponse.json()
              const enrichedLead = data.leads.find((l: Lead) => l.id === selectedLead.id)
              if (enrichedLead) {
                setSelectedLead(enrichedLead)
              }
            }
          } else {
            setBackendLogs(prev => [...prev, '[LinkedIn] ⚠ Enrichment skipped (no session or already enriched)'])
          }
        } catch (enrichError) {
          console.error('LinkedIn enrichment failed:', enrichError)
          setBackendLogs(prev => [...prev, '[LinkedIn] ⚠ Enrichment failed, continuing with basic data'])
        }
      }

      // Initiate call via API
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          scriptId: selectedScript.id,
          // voicePersona removed - backend auto-selects
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to initiate call')
      }

      const data = await response.json()
      setCurrentCallId(data.callId)

      setCallStatus('calling')
      setTranscript([
        {
          speaker: 'rep',
          text: selectedScript.content
            .replace(/\{\{firstName\}\}/g, selectedLead.firstName)
            .replace(/\{\{lastName\}\}/g, selectedLead.lastName)
            .replace(/\{\{company\}\}/g, selectedLead.company || '')
            .replace(/\{\{jobTitle\}\}/g, selectedLead.jobTitle || ''),
          timestamp: new Date()
        }
      ])

      // Start polling for call status
      pollCallStatus(data.callId)
    } catch (error) {
      console.error('Failed to start call:', error)
      alert('Failed to start call. Please try again.')
      setCallStatus('idle')
    }
  }

  const pollCallStatus = async (callId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
        const response = await fetch(`${backendUrl}/api/calls/${callId}/status`)

        if (response.ok) {
          const data = await response.json()

          // Update transcript if new entries
          if (data.transcript && data.transcript.length > transcript.length) {
            const newTranscript = data.transcript.map((entry: any) => ({
              speaker: entry.speaker,
              text: entry.text,
              timestamp: new Date(entry.timestamp)
            }))
            setTranscript(newTranscript)

            // Add backend-style logs for each new entry
            const newEntries = data.transcript.slice(transcript.length)
            newEntries.forEach((entry: any) => {
              const logEntry = entry.speaker === 'agent'
                ? `[AI Reply] ${entry.text}`
                : `[User Speech] ${entry.text}`
              setBackendLogs(prev => [...prev, logEntry].slice(-20)) // Keep last 20 logs
            })
          }

          // Check if call ended
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(pollInterval)
            setCallStatus('ended')
            setBackendLogs(prev => [...prev, `[Call End] Call ${data.status}. Transcript saved to database.`])
          }
        }
      } catch (error) {
        console.error('Failed to poll call status:', error)
      }
    }, 2000) // Poll every 2 seconds
  }

  const handleEndCall = () => {
    setCallStatus('ended')
    setShowPostCallSummary(true)
  }

  const handlePostCallComplete = () => {
    setShowPostCallSummary(false)
    setCallStatus('idle')
    setSelectedLead(null)
    setTranscript([])
    setCurrentCallId(null)
    fetchLeads()
  }

  const handlePauseResume = () => {
    setCallStatus(callStatus === 'calling' ? 'paused' : 'calling')
  }

  // Render call preparation screen
  if (callStatus === 'idle') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Start a Call</h1>
          <p className="text-slate-500 mt-2">Select a lead and prepare your call</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle>Select Lead</CardTitle>
              </div>
              <CardDescription>Choose a lead to call</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500">No pending leads. Upload leads first.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {leads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedLead?.id === lead.id
                        ? 'border-blue-600 bg-blue-50'
                        : lead.phone ? 'border-slate-200 hover:border-slate-300' : 'border-orange-200 bg-orange-50 hover:border-orange-300'
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-slate-900">
                            {lead.firstName} {lead.lastName}
                          </h3>
                          <p className="text-sm text-slate-500">{lead.company}</p>
                          <p className="text-sm text-slate-500">{lead.jobTitle}</p>
                          {lead.phone ? (
                            <p className="text-xs text-slate-400 mt-1">{lead.phone}</p>
                          ) : (
                            <p className="text-xs text-orange-600 mt-1">⚠️ No phone number</p>
                          )}
                        </div>
                        {lead.linkedinEnriched && (
                          <Linkedin className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Script Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary" />
                <CardTitle>Select Script</CardTitle>
              </div>
              <CardDescription>Choose your opening script</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scripts.map((script) => (
                  <div
                    key={script.id}
                    onClick={() => setSelectedScript(script)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedScript?.id === script.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-slate-900">{script.name}</h3>
                      {script.isDefault && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{script.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Voice Selection - Auto-Rotated */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-blue-600" />
              <CardTitle>Voice Persona</CardTitle>
            </div>
            <CardDescription>Voice automatically rotated for natural variety</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-slate-900 mb-2">🎲 Auto-Selected Voice Pool</h3>
              <p className="text-sm text-slate-600 mb-3">
                Each call randomly selects from our diverse voice pool for natural variety:
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
                  <span>Arabella (Female)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span>Anika (Female)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Brandon (Male)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Adam (Male)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  <span>Jane (Female)</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                💡 Future: Voice selection based on lead location/accent
              </p>
            </div>
          </CardContent>
        </Card>

        {/* LinkedIn Enrichment Preview */}
        {selectedLead?.linkedinEnriched && (
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Linkedin className="w-5 h-5 text-blue-600" />
                <CardTitle>LinkedIn Profile</CardTitle>
              </div>
              <CardDescription>Enriched lead information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  <strong>Company:</strong> {selectedLead.company}
                </p>
                <p className="text-sm text-slate-600">
                  <strong>Title:</strong> {selectedLead.jobTitle}
                </p>
                {selectedLead.linkedinUrl && (
                  <a
                    href={selectedLead.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View LinkedIn Profile →
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Start Call Button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            size="lg"
            onClick={handleStartCall}
            disabled={!selectedLead || !selectedScript || !selectedLead?.phone}
            className="px-8"
          >
            <Phone className="w-5 h-5 mr-2" />
            Start Call
          </Button>
          {selectedLead && !selectedLead.phone && (
            <p className="text-sm text-orange-600">⚠️ This lead has no phone number. Add one in the Leads page.</p>
          )}
        </div>
      </div>
    )
  }

  // Render live call interface
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {callStatus === 'ended' ? 'Call Ended' : 'Live Call'}
          </h1>
          <p className="text-slate-500 mt-2">
            {selectedLead?.firstName} {selectedLead?.lastName} • {selectedLead?.company}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {callStatus === 'calling' && (
            <>
              <Button variant="outline" onClick={handlePauseResume}>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
              <Button variant="destructive" onClick={handleEndCall}>
                <PhoneOff className="w-4 h-4 mr-2" />
                End Call
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Transcription */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Mic className="w-5 h-5 text-primary" />
              <CardTitle>Live Transcription</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {transcript.map((entry, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${entry.speaker === 'rep'
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-slate-50 border border-slate-200'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-500">
                      {entry.speaker === 'rep' ? 'You' : selectedLead?.firstName}
                    </span>
                    <span className="text-xs text-slate-400">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700">{entry.text}</p>
                </div>
              ))}
              {callStatus === 'calling' && (
                <div className="flex items-center space-x-2 text-slate-400">
                  <div className="animate-pulse">●</div>
                  <span className="text-sm">Listening...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Backend Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Backend Logs</CardTitle>
            <CardDescription>Live system activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto bg-slate-900 rounded-lg p-3 font-mono text-xs">
              {backendLogs.length > 0 ? (
                backendLogs.map((log, index) => (
                  <div key={index} className="text-green-400">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-slate-500">
                  No logs yet. Start a call to see backend activity.
                </div>
              )}
            </div>
            {currentCallId && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                <p className="font-semibold text-slate-700">📁 Transcript Storage:</p>
                <p className="text-slate-600 mt-1">Database → Call ID: {currentCallId.substring(0, 8)}...</p>
                <p className="text-slate-500 mt-1">View in: Analytics or Lead History</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {callStatus === 'ended' && (
        <Card>
          <CardHeader>
            <CardTitle>Call Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Call ended. Review the transcript and analyze the call for detailed insights.
              </p>
              <div className="flex space-x-3">
                <Button onClick={() => setCallStatus('idle')}>Start New Call</Button>
                <Button variant="outline" onClick={() => setShowPostCallSummary(true)}>
                  Analyze Call
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post-Call Summary Dialog */}
      {currentCallId && (
        <PostCallSummary
          open={showPostCallSummary}
          onOpenChange={setShowPostCallSummary}
          callId={currentCallId}
          onComplete={handlePostCallComplete}
        />
      )}
    </div>
  )
}
