'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Loader2, TrendingUp, AlertCircle, Mail, CheckCircle, Calendar, MessageSquare, ThumbsUp, ThumbsDown, Lightbulb, Clock, Mic } from 'lucide-react'

interface PostCallSummaryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  callId: string
  onComplete: () => void
}

export function PostCallSummary({ open, onOpenChange, callId, onComplete }: PostCallSummaryProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'coaching'>('summary')
  const [manualNotes, setManualNotes] = useState({
    emailCaptured: '',
    nextSteps: '',
    demoDate: '',
    demoTime: '',
  })

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const response = await fetch(`/api/calls/${callId}/analyze`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setAnalysis(data.analysis)

        // Pre-fill manual fields if AI detected them
        if (data.analysis.emailCaptured) {
          setManualNotes(prev => ({ ...prev, emailCaptured: data.analysis.emailCaptured }))
        }
        if (data.analysis.nextSteps) {
          setManualNotes(prev => ({ ...prev, nextSteps: data.analysis.nextSteps }))
        }
      } else {
        alert('Failed to analyze call')
      }
    } catch (error) {
      console.error('Analysis error:', error)
      alert('Failed to analyze call')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSaveManualNotes = async () => {
    try {
      const scheduledDemo = manualNotes.demoDate && manualNotes.demoTime
        ? new Date(`${manualNotes.demoDate}T${manualNotes.demoTime}`)
        : null

      const response = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailCaptured: manualNotes.emailCaptured || null,
          nextSteps: manualNotes.nextSteps || null,
          scheduledDemo: scheduledDemo,
        }),
      })

      if (response.ok) {
        onComplete()
        onOpenChange(false)
      } else {
        alert('Failed to save notes')
      }
    } catch (error) {
      console.error('Save notes error:', error)
      alert('Failed to save notes')
    }
  }

  const getInterestColor = (level: string) => {
    const colors = {
      high: 'text-green-600 bg-green-50 border-green-200',
      medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      low: 'text-orange-600 bg-orange-50 border-orange-200',
      not_interested: 'text-red-600 bg-red-50 border-red-200',
    }
    return colors[level as keyof typeof colors] || 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const getSentimentColor = (sentiment: string) => {
    const colors = {
      positive: 'text-green-600',
      neutral: 'text-gray-600',
      negative: 'text-red-600',
    }
    return colors[sentiment as keyof typeof colors] || 'text-gray-600'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Post-Call Analysis</DialogTitle>
          <DialogDescription>
            Comprehensive AI-powered call review with coaching feedback
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {!analysis ? (
            <div className="text-center py-12">
              <Button onClick={handleAnalyze} disabled={analyzing} size="lg">
                {analyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing Call...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Analyze Call with AI
                  </>
                )}
              </Button>
              <p className="text-sm text-slate-500 mt-3">
                AI will analyze the full transcript, tone, and provide coaching feedback
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Tab Navigation */}
              <div className="flex border-b mb-4">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'summary'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                  📊 Summary
                </button>
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'transcript'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                  💬 Full Transcript
                </button>
                <button
                  onClick={() => setActiveTab('coaching')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'coaching'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                  🎯 Coaching
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {activeTab === 'summary' && (
                  <>
                    {/* Call Duration & Interest Level */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-3 rounded-lg border">
                        <div className="flex items-center space-x-2 text-sm text-slate-500 mb-1">
                          <Clock className="w-4 h-4" />
                          <span>Call Duration</span>
                        </div>
                        <p className="font-medium">{analysis.callDuration || 'Unknown'}</p>
                      </div>
                      <div className={`p-3 rounded-lg border ${getInterestColor(analysis.interestLevel)}`}>
                        <div className="flex items-center space-x-2 text-sm mb-1">
                          <TrendingUp className="w-4 h-4" />
                          <span>Interest Level</span>
                        </div>
                        <p className="font-medium capitalize">{analysis.interestLevel?.replace('_', ' ')}</p>
                      </div>
                    </div>

                    {/* AI Summary */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Executive Summary
                      </h4>
                      <p className="text-sm text-blue-900">{analysis.aiSummary}</p>
                    </div>

                    {/* Tone Analysis */}
                    {analysis.toneAnalysis && (
                      <div className="bg-slate-50 p-4 rounded-lg border">
                        <h4 className="text-sm font-medium mb-3 flex items-center">
                          <Mic className="w-4 h-4 mr-2" />
                          Tone Analysis
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-slate-500">Prospect Tone:</span>
                            <p className="text-sm">{analysis.toneAnalysis.prospectTone}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">Agent Tone:</span>
                            <p className="text-sm">{analysis.toneAnalysis.agentTone}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-500">Overall Sentiment:</span>
                            <p className={`text-sm font-medium capitalize ${getSentimentColor(analysis.toneAnalysis.overallSentiment)}`}>
                              {analysis.toneAnalysis.overallSentiment}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Objections */}
                    {analysis.objections && analysis.objections.length > 0 && (
                      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                          <h4 className="text-sm font-medium text-orange-800">Objections Raised</h4>
                        </div>
                        <ul className="space-y-1 pl-6">
                          {analysis.objections.map((obj: string, idx: number) => (
                            <li key={idx} className="text-sm text-orange-900">• {obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Key Moments */}
                    {analysis.keyMoments && analysis.keyMoments.length > 0 && (
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <h4 className="text-sm font-medium text-purple-800 mb-2">📍 Key Moments</h4>
                        <div className="space-y-2">
                          {analysis.keyMoments.map((moment: any, idx: number) => (
                            <div key={idx} className="flex items-start space-x-2 text-sm">
                              <span className="text-purple-600 font-mono text-xs bg-purple-100 px-1.5 py-0.5 rounded">
                                {moment.timestamp}
                              </span>
                              <span className="text-purple-900">{moment.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Next Steps */}
                    {analysis.nextSteps && (
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <h4 className="text-sm font-medium text-green-800">Recommended Next Steps</h4>
                        </div>
                        <p className="text-sm text-green-900">{analysis.nextSteps}</p>
                      </div>
                    )}

                    {/* Manual Fields */}
                    <div className="border-t pt-4 space-y-4">
                      <h4 className="text-sm font-medium">Additional Details</h4>

                      <div>
                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-1">
                          <Mail className="w-4 h-4" />
                          <span>Email Captured</span>
                        </label>
                        <Input
                          type="email"
                          value={manualNotes.emailCaptured}
                          onChange={(e) => setManualNotes(prev => ({ ...prev, emailCaptured: e.target.value }))}
                          placeholder="lead@company.com"
                        />
                      </div>

                      <div>
                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-1">
                          <Calendar className="w-4 h-4" />
                          <span>Demo Scheduled</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="date"
                            value={manualNotes.demoDate}
                            onChange={(e) => setManualNotes(prev => ({ ...prev, demoDate: e.target.value }))}
                          />
                          <Input
                            type="time"
                            value={manualNotes.demoTime}
                            onChange={(e) => setManualNotes(prev => ({ ...prev, demoTime: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'transcript' && (
                  <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
                    <h4 className="text-slate-400 text-xs uppercase tracking-wide mb-3">Full Call Transcript</h4>
                    {analysis.fullTranscript && analysis.fullTranscript.length > 0 ? (
                      <div className="space-y-3">
                        {analysis.fullTranscript.map((entry: any, idx: number) => (
                          <div key={idx} className={`${entry.speaker === 'agent' ? 'text-blue-400' : 'text-green-400'}`}>
                            <span className="text-slate-500 text-xs">[{idx + 1}]</span>{' '}
                            <span className="font-semibold">
                              {entry.speaker === 'agent' ? 'Alex (Agent)' : 'Prospect'}:
                            </span>{' '}
                            <span className="text-slate-100">{entry.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No transcript available</p>
                    )}
                  </div>
                )}

                {activeTab === 'coaching' && (
                  <>
                    {/* What Went Well */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <ThumbsUp className="w-5 h-5 text-green-600" />
                        <h4 className="font-medium text-green-800">What Went Well</h4>
                      </div>
                      {analysis.whatWentWell && analysis.whatWentWell.length > 0 ? (
                        <ul className="space-y-2">
                          {analysis.whatWentWell.map((item: string, idx: number) => (
                            <li key={idx} className="flex items-start space-x-2 text-sm text-green-900">
                              <span className="text-green-500 mt-0.5">✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-green-700 italic">No specific positives identified</p>
                      )}
                    </div>

                    {/* What Could Be Improved */}
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <ThumbsDown className="w-5 h-5 text-red-600" />
                        <h4 className="font-medium text-red-800">Areas for Improvement</h4>
                      </div>
                      {analysis.whatWentWrong && analysis.whatWentWrong.length > 0 ? (
                        <ul className="space-y-2">
                          {analysis.whatWentWrong.map((item: string, idx: number) => (
                            <li key={idx} className="flex items-start space-x-2 text-sm text-red-900">
                              <span className="text-red-500 mt-0.5">→</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-red-700 italic">No specific improvements identified</p>
                      )}
                    </div>

                    {/* Coaching Feedback */}
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <Lightbulb className="w-5 h-5 text-yellow-600" />
                        <h4 className="font-medium text-yellow-800">Coaching Advice</h4>
                      </div>
                      <p className="text-sm text-yellow-900">
                        {analysis.coachingFeedback || 'Keep up the good work! Practice makes perfect.'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {analysis && (
            <Button onClick={handleSaveManualNotes}>
              Save & Complete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
