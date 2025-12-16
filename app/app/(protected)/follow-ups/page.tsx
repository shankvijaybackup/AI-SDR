'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from 'lucide-react'

export default function FollowUpsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Follow-ups</h1>
        <p className="text-slate-500 mt-2">Manage your scheduled follow-ups and demos</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-primary" />
            <CardTitle>Follow-up Management</CardTitle>
          </div>
          <CardDescription>
            Track scheduled demos and follow-up calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Follow-ups Coming Soon</h3>
            <p className="text-slate-500">
              This feature will include calendar integration and automated follow-up emails
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
