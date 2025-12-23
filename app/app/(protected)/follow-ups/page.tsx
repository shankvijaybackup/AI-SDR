'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Phone,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  PhoneCall,
  CalendarClock,
  MessageSquare,
  ChevronDown
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Lead {
  id: string
  firstName: string
  lastName: string
  company: string | null
  phone: string
  email: string | null
}

interface CallInfo {
  id: string
  aiSummary: string | null
  outcome: string | null
  nextSteps: string | null
}

interface FollowUp {
  id: string
  type: 'demo' | 'callback' | 'action'
  priority: 'high' | 'medium' | 'low'
  dueDate: string
  isOverdue: boolean
  lead: Lead
  call: CallInfo | null
  description: string
}

interface Stats {
  total: number
  overdue: number
  today: number
  thisWeek: number
}

type FilterType = 'all' | 'demo' | 'callback' | 'action' | 'overdue'

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, overdue: 0, today: 0, thisWeek: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchFollowUps()
  }, [])

  const fetchFollowUps = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/follow-ups')
      if (response.ok) {
        const data = await response.json()
        setFollowUps(data.followUps)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch follow-ups:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (followUpId: string) => {
    setActionLoading(followUpId)
    try {
      const response = await fetch('/api/follow-ups/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpId, action: 'complete' }),
      })
      if (response.ok) {
        setFollowUps(prev => prev.filter(f => f.id !== followUpId))
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          overdue: followUps.find(f => f.id === followUpId)?.isOverdue ? prev.overdue - 1 : prev.overdue,
        }))
      }
    } catch (error) {
      console.error('Failed to complete follow-up:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSnooze = async (followUpId: string, days: number) => {
    setActionLoading(followUpId)
    try {
      const snoozeUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      const response = await fetch('/api/follow-ups/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpId, action: 'snooze', snoozeUntil }),
      })
      if (response.ok) {
        fetchFollowUps() // Refresh to get updated dates
      }
    } catch (error) {
      console.error('Failed to snooze follow-up:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCall = async (leadId: string) => {
    // Navigate to calling page with this lead pre-selected
    window.location.href = `/leads?callLead=${leadId}`
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMs < 0) {
      const absDays = Math.abs(diffDays)
      const absHours = Math.abs(diffHours)
      if (absDays > 0) return `${absDays} day${absDays > 1 ? 's' : ''} overdue`
      if (absHours > 0) return `${absHours} hour${absHours > 1 ? 's' : ''} overdue`
      return 'Just now'
    }
    if (diffDays > 0) return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`
    if (diffHours > 0) return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`
    return 'Soon'
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'demo': return <CalendarClock className="w-4 h-4" />
      case 'callback': return <PhoneCall className="w-4 h-4" />
      case 'action': return <MessageSquare className="w-4 h-4" />
      default: return <Calendar className="w-4 h-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'demo': return 'Demo'
      case 'callback': return 'Callback'
      case 'action': return 'Action'
      default: return 'Follow-up'
    }
  }

  const getPriorityColor = (priority: string, isOverdue: boolean) => {
    if (isOverdue) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    switch (priority) {
      case 'high': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      case 'medium': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    }
  }

  const filteredFollowUps = followUps.filter(f => {
    if (filter === 'all') return true
    if (filter === 'overdue') return f.isOverdue
    return f.type === filter
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Follow-ups</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Manage your scheduled demos, callbacks, and action items</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-200/50 dark:border-red-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Overdue</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{stats.overdue}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-400 dark:text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200/50 dark:border-amber-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Due Today</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.today}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400 dark:text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">This Week</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.thisWeek}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400 dark:text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 border-slate-200/50 dark:border-slate-700/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total</p>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{stats.total}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'overdue', 'demo', 'callback', 'action'] as FilterType[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className={filter === f ? '' : 'text-slate-600 dark:text-slate-400'}
          >
            {f === 'all' ? 'All' : f === 'overdue' ? 'Overdue' : getTypeLabel(f)}
            {f === 'overdue' && stats.overdue > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5">{stats.overdue}</Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Follow-up Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-white">Pending Follow-ups</CardTitle>
          <CardDescription>
            {filteredFollowUps.length} follow-up{filteredFollowUps.length !== 1 ? 's' : ''} to handle
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : filteredFollowUps.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">All caught up!</h3>
              <p className="text-slate-500 dark:text-slate-400">
                {filter === 'all' ? 'No pending follow-ups' : `No ${filter} follow-ups`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFollowUps.map((followUp) => (
                <div
                  key={followUp.id}
                  className={`p-4 rounded-lg border transition-all ${followUp.isOverdue
                      ? 'border-red-200 bg-red-50/50 dark:border-red-800/50 dark:bg-red-950/20'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50'
                    }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getPriorityColor(followUp.priority, followUp.isOverdue)}>
                          {getTypeIcon(followUp.type)}
                          <span className="ml-1">{getTypeLabel(followUp.type)}</span>
                        </Badge>
                        <span className={`text-sm font-medium ${followUp.isOverdue ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {formatRelativeTime(followUp.dueDate)}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        {followUp.lead.firstName} {followUp.lead.lastName}
                        {followUp.lead.company && (
                          <span className="font-normal text-slate-500 dark:text-slate-400"> · {followUp.lead.company}</span>
                        )}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {followUp.description}
                      </p>
                      {followUp.call?.aiSummary && (
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 line-clamp-2">
                          {followUp.call.aiSummary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleCall(followUp.lead.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleComplete(followUp.id)}
                        disabled={actionLoading === followUp.id}
                      >
                        {actionLoading === followUp.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Clock className="w-4 h-4" />
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleSnooze(followUp.id, 1)}>
                            Snooze 1 day
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSnooze(followUp.id, 3)}>
                            Snooze 3 days
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSnooze(followUp.id, 7)}>
                            Snooze 1 week
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
