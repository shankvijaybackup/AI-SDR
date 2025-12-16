'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, TrendingUp, Users, Calendar, Clock, Target, Award, AlertCircle } from 'lucide-react'

type TimeRange = '7d' | '30d' | '90d' | 'all'

interface LegacyAnalyticsData {
  totalCalls: number
  totalLeads: number
  averageDuration: number
  interestBreakdown: {
    high: number
    medium: number
    low: number
    not_interested: number
  }
  callsToday: number
  demosScheduled: number
  emailsCaptured: number
  topObjections: Array<{ objection: string; count: number }>
  recentCalls: Array<{
    id: string
    leadName: string
    company: string
    interestLevel: string
    createdAt: string
  }>
}

interface OverviewAnalyticsData {
  summary: {
    totalCalls: number
    completedCalls: number
    conversionRate: number
    interestRate: number
    avgDuration: number
    avgSentiment: number
    avgEngagement: number
    avgQuality: number
  }
  outcomes: Record<string, number>
  topObjections: Array<{ objection: string; count: number }>
  dailyVolume: Array<{ date: string; calls: number; booked: number }>
  funnelStages: Record<string, number>
  timeRange: string
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>('7d')
  const [legacy, setLegacy] = useState<LegacyAnalyticsData | null>(null)
  const [overview, setOverview] = useState<OverviewAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const [legacyRes, overviewRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch(`/api/analytics/overview?range=${range}`),
      ])

      if (legacyRes.ok) {
        const legacyData = await legacyRes.json()
        setLegacy(legacyData)
      }

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json()
        setOverview(overviewData)
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!legacy || !overview) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Failed to load analytics</p>
      </div>
    )
  }

  const conversionRate = `${overview.summary.conversionRate.toFixed(1)}%`
  const interestRate = `${overview.summary.interestRate.toFixed(1)}%`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics Dashboard</h1>
          <p className="text-slate-500 mt-2">Track your calling performance and insights</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Range</label>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value as TimeRange)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.summary.totalCalls}</div>
            <p className="text-xs text-muted-foreground">
              {legacy.callsToday} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{legacy.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              In pipeline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(overview.summary.avgDuration / 60)}m {overview.summary.avgDuration % 60}s
            </div>
            <p className="text-xs text-muted-foreground">
              Per call
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate}</div>
            <p className="text-xs text-muted-foreground">
              Interest rate: {interestRate}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Interest Breakdown & Demos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Interest Level Breakdown</CardTitle>
            <CardDescription>Distribution of lead interest after calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium">High Interest</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-600">{legacy.interestBreakdown.high}</span>
                  <span className="text-xs text-slate-400">
                    ({legacy.totalCalls > 0 ? ((legacy.interestBreakdown.high / legacy.totalCalls) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-sm font-medium">Medium Interest</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-600">{legacy.interestBreakdown.medium}</span>
                  <span className="text-xs text-slate-400">
                    ({legacy.totalCalls > 0 ? ((legacy.interestBreakdown.medium / legacy.totalCalls) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm font-medium">Low Interest</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-600">{legacy.interestBreakdown.low}</span>
                  <span className="text-xs text-slate-400">
                    ({legacy.totalCalls > 0 ? ((legacy.interestBreakdown.low / legacy.totalCalls) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm font-medium">Not Interested</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-slate-600">{legacy.interestBreakdown.not_interested}</span>
                  <span className="text-xs text-slate-400">
                    ({legacy.totalCalls > 0 ? ((legacy.interestBreakdown.not_interested / legacy.totalCalls) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Metrics</CardTitle>
            <CardDescription>Key outcomes from your calls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium">Demos Scheduled</span>
                </div>
                <span className="text-2xl font-bold text-green-600">{legacy.demosScheduled}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium">Emails Captured</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">{legacy.emailsCaptured}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Objections */}
      <Card>
        <CardHeader>
          <CardTitle>Top Objections</CardTitle>
          <CardDescription>Most common objections raised by leads</CardDescription>
        </CardHeader>
        <CardContent>
          {overview.topObjections.length === 0 ? (
            <p className="text-sm text-slate-500">No objections recorded yet</p>
          ) : (
            <div className="space-y-2">
              {overview.topObjections.map((obj, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-sm">{obj.objection}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-600">{obj.count}x</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
          <CardDescription>Latest calling activity</CardDescription>
        </CardHeader>
        <CardContent>
          {legacy.recentCalls.length === 0 ? (
            <p className="text-sm text-slate-500">No calls yet</p>
          ) : (
            <div className="space-y-2">
              {legacy.recentCalls.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{call.leadName}</p>
                    <p className="text-xs text-slate-500">{call.company}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      call.interestLevel === 'high' ? 'bg-green-100 text-green-800' :
                      call.interestLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      call.interestLevel === 'low' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {call.interestLevel || 'pending'}
                    </span>
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
