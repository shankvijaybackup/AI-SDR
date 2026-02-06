'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Phone, Clock, User, MessageSquare, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

interface CallDetailDialogProps {
  call: any
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CallDetailDialog({ call, open, onOpenChange }: CallDetailDialogProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!call) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Call Details</DialogTitle>
            <Badge
              variant={
                call.status === 'completed'
                  ? 'default'
                  : call.status === 'failed'
                  ? 'destructive'
                  : 'secondary'
              }
            >
              {call.status}
            </Badge>
          </div>
          <DialogDescription>
            Complete call logs and transcript
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Call Metadata */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-xs text-slate-500 mb-1">Call ID</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-white px-2 py-1 rounded border">
                  {call.id}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(call.id)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                {copied && (
                  <span className="text-xs text-green-600">Copied!</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Twilio Call SID</p>
              <code className="text-xs font-mono bg-white px-2 py-1 rounded border block">
                {call.twilioCallSid || 'N/A'}
              </code>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Duration</p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium">
                  {call.duration ? `${call.duration}s` : 'N/A'}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Voice Persona</p>
              <span className="text-sm font-medium">
                {call.voicePersona || 'N/A'}
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">From Number</p>
              <span className="text-sm font-medium">
                {call.fromNumber || 'N/A'}
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Company Name</p>
              <span className="text-sm font-medium">
                {call.companyName || 'N/A'}
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Called At</p>
              <span className="text-sm">
                {format(new Date(call.createdAt), 'MMM d, yyyy h:mm:ss a')}
              </span>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Updated At</p>
              <span className="text-sm">
                {format(new Date(call.updatedAt), 'MMM d, yyyy h:mm:ss a')}
              </span>
            </div>
          </div>

          {/* AI Summary */}
          {call.aiSummary && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-blue-900">AI Summary</h3>
              </div>
              <p className="text-sm text-blue-800">{call.aiSummary}</p>
            </div>
          )}

          {/* Engagement Metrics */}
          {(call.engagementScore || call.sentimentScore || call.callQualityScore) && (
            <div className="grid grid-cols-3 gap-4">
              {call.engagementScore && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 mb-1">Engagement</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {call.engagementScore}/10
                  </p>
                </div>
              )}
              {call.sentimentScore && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 mb-1">Sentiment</p>
                  <p className="text-2xl font-bold text-green-700">
                    {call.sentimentScore}/10
                  </p>
                </div>
              )}
              {call.callQualityScore && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 mb-1">Quality</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {call.callQualityScore}/10
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Full Transcript */}
          <div className="border rounded-lg">
            <div className="flex items-center gap-2 p-4 bg-slate-50 border-b">
              <MessageSquare className="h-5 w-5 text-slate-600" />
              <h3 className="font-semibold text-slate-900">Full Transcript</h3>
              {call.transcript && call.transcript.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {call.transcript.length} messages
                </Badge>
              )}
            </div>
            <div className="p-4">
              {!call.transcript || call.transcript.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">
                    No transcript available
                  </p>
                  <p className="text-slate-400 text-xs mt-1">
                    The conversation was not captured by the WebSocket
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {call.transcript.map((entry: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        entry.speaker === 'agent'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3 w-3 text-slate-400" />
                        <span
                          className={`text-xs font-semibold ${
                            entry.speaker === 'agent'
                              ? 'text-blue-700'
                              : 'text-slate-700'
                          }`}
                        >
                          {entry.speaker === 'agent'
                            ? 'AI Agent (Alex)'
                            : `Lead (${call.lead?.firstName || 'Unknown'})`}
                        </span>
                        {entry.timestamp && (
                          <span className="text-xs text-slate-400 ml-auto">
                            {format(new Date(entry.timestamp), 'HH:mm:ss')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800">{entry.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Objections */}
          {call.objections && call.objections.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-semibold text-amber-900 mb-2">
                Objections Raised
              </h3>
              <ul className="list-disc list-inside space-y-1">
                {call.objections.map((objection: string, idx: number) => (
                  <li key={idx} className="text-sm text-amber-800">
                    {objection}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {call.nextSteps && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Next Steps</h3>
              <p className="text-sm text-green-800">{call.nextSteps}</p>
            </div>
          )}

          {/* Disconnect Reason */}
          {call.disconnectReason && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-2">
                Disconnect Reason
              </h3>
              <p className="text-sm text-red-800">{call.disconnectReason}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
