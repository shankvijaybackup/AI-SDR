'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Phone, Calendar, TrendingUp } from 'lucide-react'

interface DashboardStats {
  totalLeads: number
  pendingCalls: number
  completedCalls: number
  upcomingFollowUps: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    pendingCalls: 0,
    completedCalls: 0,
    upcomingFollowUps: 0,
  })

  useEffect(() => {
    // TODO: Fetch actual stats from API
    setStats({
      totalLeads: 0,
      pendingCalls: 0,
      completedCalls: 0,
      upcomingFollowUps: 0,
    })
  }, [])

  const statCards = [
    {
      title: 'Total Leads',
      value: stats.totalLeads,
      description: 'Leads in your pipeline',
      icon: Users,
      color: 'text-blue-600',
    },
    {
      title: 'Pending Calls',
      value: stats.pendingCalls,
      description: 'Ready to call',
      icon: Phone,
      color: 'text-green-600',
    },
    {
      title: 'Completed Calls',
      value: stats.completedCalls,
      description: 'This week',
      icon: TrendingUp,
      color: 'text-purple-600',
    },
    {
      title: 'Follow-ups',
      value: stats.upcomingFollowUps,
      description: 'Scheduled this week',
      icon: Calendar,
      color: 'text-orange-600',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-2">Welcome back! Here's your overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>Get started with your AI SDR workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Upload Leads</h3>
              <p className="text-sm text-slate-500 mt-1">
                Import your leads from CSV to get started with calling
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Start Calling</h3>
              <p className="text-sm text-slate-500 mt-1">
                Begin making AI-powered calls to your leads
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
