'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Loader2, TrendingUp, AlertCircle, Mail, CheckCircle, Calendar } from 'lucide-react'

interface PostCallSummaryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  callId: string
  onComplete: () => void
}

export function PostCallSummary({ open, onOpenChange, callId, onComplete }: PostCallSummaryProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
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
      high: 'text-green-600 bg-green-50',
      medium: 'text-yellow-600 bg-yellow-50',
      low: 'text-orange-600 bg-orange-50',
      not_interested: 'text-red-600 bg-red-50',
    }
    return colors[level as keyof typeof colors] || 'text-gray-600 bg-gray-50'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post-Call Summary</DialogTitle>
          <DialogDescription>
            Review the call and add any additional notes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {!analysis ? (
            <div className="text-center py-8">
              <Button onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing Call...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Analyze Call with AI
                  </>
                )}
              </Button>
              <p className="text-sm text-slate-500 mt-2">
                AI will analyze the transcript and extract insights
              </p>
            </div>
          ) : (
            <>
              {/* AI Summary */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-2">AI Summary</h4>
                <p className="text-sm text-slate-600">{analysis.aiSummary}</p>
              </div>

              {/* Interest Level */}
              <div className={`p-4 rounded-lg ${getInterestColor(analysis.interestLevel)}`}>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-medium">Interest Level: {analysis.interestLevel}</span>
                </div>
              </div>

              {/* Objections */}
              {analysis.objections && analysis.objections.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <h4 className="text-sm font-medium">Objections Raised</h4>
                  </div>
                  <ul className="space-y-1 pl-6">
                    {analysis.objections.map((obj: string, idx: number) => (
                      <li key={idx} className="text-sm text-slate-600">• {obj}</li>
                    ))}
                  </ul>
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
                    <CheckCircle className="w-4 h-4" />
                    <span>Next Steps</span>
                  </label>
                  <textarea
                    value={manualNotes.nextSteps}
                    onChange={(e) => setManualNotes(prev => ({ ...prev, nextSteps: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                    placeholder="Follow up next week, send case study, etc."
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
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
