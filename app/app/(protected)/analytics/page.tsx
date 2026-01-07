'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatsOverview } from '@/components/analytics/StatsOverview'
import { OutcomeDistribution } from '@/components/analytics/OutcomeDistribution'
import { ObjectionsChart } from '@/components/analytics/ObjectionsChart'
import { Loader2 } from 'lucide-react'


// Chart colors


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
  const [funnelData, setFunnelData] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [heatmapData, setHeatmapData] = useState<any[]>([])

  useEffect(() => {
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const [legacyRes, overviewRes, funnelRes, perfRes, heatmapRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch(`/api/analytics/overview?range=${range}`),
        fetch('/api/analytics/funnel'),
        fetch('/api/analytics/performance'),
        fetch('/api/analytics/heatmap')
      ])

      if (legacyRes.ok) setLegacy(await legacyRes.json())
      if (overviewRes.ok) setOverview(await overviewRes.json())
      if (funnelRes.ok) setFunnelData(await funnelRes.json())
      if (perfRes.ok) setLeaderboard(await perfRes.json())
      if (heatmapRes.ok) setHeatmapData(await heatmapRes.json())

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



  // Heatmap helper
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const HOURS = Array.from({ length: 24 }, (_, i) => i)

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
      <StatsOverview overview={overview} legacy={legacy} />

      {/* Funnel & Interest */}
      <OutcomeDistribution funnelData={funnelData} interestBreakdown={legacy.interestBreakdown} />

      {/* Top Objections & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ObjectionsChart data={overview.topObjections} />

        {/* Leaderboard - moved here to sit next to Objections */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Performance</CardTitle>
            <CardDescription>Top performing agents by success rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No data available</p>
              ) : (
                leaderboard.map((agent, i) => (
                  <div key={agent.agentId} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs
                                      ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                          i === 1 ? 'bg-slate-200 text-slate-700' :
                            'bg-orange-50 text-orange-700'}`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{agent.name}</p>
                        <p className="text-xs text-slate-500">{agent.totalCalls} calls</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">{agent.successRate}%</div>
                      <p className="text-xs text-slate-500">Success Rate</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Call Heatmap (Pickup Rates)</CardTitle>
          <CardDescription>Best times to call (darker = higher pickup rate)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px] grid grid-cols-[auto_repeat(24,1fr)] gap-1">
              {/* Header Row */}
              <div className="h-8"></div>
              {HOURS.map(h => (
                <div key={h} className="text-[10px] text-center text-slate-400">{h}</div>
              ))}

              {/* Rows */}
              {DAYS.map((day, dayIdx) => (
                <React.Fragment key={day}>
                  <div key={`label-${day}`} className="text-xs text-slate-500 font-medium pr-2 flex items-center justify-end">{day}</div>
                  {HOURS.map(hour => {
                    const cell = heatmapData.find(d => d.day === dayIdx && d.hour === hour)
                    const rate = cell ? cell.pickupRate : 0
                    const count = cell ? cell.calls : 0

                    let bg = 'bg-slate-100'
                    if (count > 0) {
                      if (rate > 75) bg = 'bg-green-600'
                      else if (rate > 50) bg = 'bg-green-400'
                      else if (rate > 25) bg = 'bg-green-300'
                      else bg = 'bg-green-200'
                    }

                    return (
                      <div
                        key={`${day}-${hour}`}
                        className={`h-8 w-full rounded-sm ${bg} hover:ring-2 ring-blue-400 transition-all cursor-help relative group`}
                      >
                        {count > 0 && (
                          <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black text-white text-xs rounded z-10 whitespace-nowrap">
                            {rate}% Pickup ({count} calls)
                          </div>
                        )}
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${call.interestLevel === 'high' ? 'bg-green-100 text-green-800' :
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
