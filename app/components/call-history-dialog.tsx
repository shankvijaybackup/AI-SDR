'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Phone, Calendar, Clock, TrendingUp, AlertCircle, Mail, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'

interface Call {
  id: string
  status: string
  disconnectReason: string | null
  duration: number | null
  transcript: any[]
  aiSummary: string | null
  interestLevel: string | null
  objections: string[]
  emailCaptured: string | null
  nextSteps: string | null
  scheduledDemo: string | null
  createdAt: string
  script: {
    name: string
  } | null
}

interface CallHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string
  leadName: string
}

export function CallHistoryDialog({ open, onOpenChange, leadId, leadName }: CallHistoryDialogProps) {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)

  useEffect(() => {
    if (open && leadId) {
      fetchCallHistory()
    }
  }, [open, leadId])

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

  const getInterestBadge = (level: string | null) => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-orange-100 text-orange-800',
      not_interested: 'bg-red-100 text-red-800',
    }
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Call History - {leadName}</DialogTitle>
          <DialogDescription>
            View all calls and interactions with this lead
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8">
            <Phone className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500">No calls yet</p>
          </div>
        ) : selectedCall ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <Button variant="outline" size="sm" onClick={() => setSelectedCall(null)}>
              ← Back to list
            </Button>

            <div className="space-y-4">
              {/* Disconnect Reason */}
              {selectedCall.disconnectReason && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">
                      {selectedCall.disconnectReason}
                    </span>
                  </div>
                </div>
              )}

              {/* Call Summary */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Call Summary</span>
                  {selectedCall.interestLevel && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInterestBadge(selectedCall.interestLevel)}`}>
                      {selectedCall.interestLevel}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {selectedCall.aiSummary || 'No summary available'}
                </p>
              </div>

              {/* Call Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{format(new Date(selectedCall.createdAt), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{formatDuration(selectedCall.duration)}</span>
                </div>
              </div>

              {/* Objections */}
              {selectedCall.objections && selectedCall.objections.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium">Objections</span>
                  </div>
                  <ul className="space-y-1">
                    {selectedCall.objections.map((obj, idx) => (
                      <li key={idx} className="text-sm text-slate-600 pl-6">• {obj}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Email Captured */}
              {selectedCall.emailCaptured && (
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Email:</span>
                  <span className="text-slate-600">{selectedCall.emailCaptured}</span>
                </div>
              )}

              {/* Next Steps */}
              {selectedCall.nextSteps && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium">Next Steps</span>
                  </div>
                  <p className="text-sm text-slate-600 pl-6">{selectedCall.nextSteps}</p>
                </div>
              )}

              {/* Demo Scheduled */}
              {selectedCall.scheduledDemo && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Demo Scheduled</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    {format(new Date(selectedCall.scheduledDemo), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}

              {/* Transcript */}
              <div>
                <h4 className="text-sm font-medium mb-2">Transcript</h4>
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg max-h-64 overflow-y-auto">
                  {selectedCall.transcript.map((entry: any, idx: number) => (
                    <div key={idx} className="text-sm">
                      <span className={`font-medium ${entry.speaker === 'rep' ? 'text-blue-600' : 'text-slate-700'}`}>
                        {entry.speaker === 'rep' ? 'Rep' : 'Lead'}:
                      </span>
                      <span className="text-slate-600 ml-2">{entry.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {calls.map((call) => (
              <div
                key={call.id}
                onClick={() => setSelectedCall(call)}
                className="p-4 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-sm">
                      {call.script?.name || 'Unknown Script'}
                    </span>
                  </div>
                  {call.interestLevel && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInterestBadge(call.interestLevel)}`}>
                      {call.interestLevel}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-4 text-xs text-slate-500">
                  <span>{format(new Date(call.createdAt), 'MMM d, yyyy')}</span>
                  <span>{formatDuration(call.duration)}</span>
                  <span className="capitalize">{call.status}</span>
                </div>
                {call.aiSummary && (
                  <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                    {call.aiSummary}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
