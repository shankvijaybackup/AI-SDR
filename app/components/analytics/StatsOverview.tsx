import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, Users, Clock, Target } from 'lucide-react'

interface StatsOverviewProps {
    overview: {
        summary: {
            totalCalls: number
            avgDuration: number
            conversionRate: number
            interestRate: number
        }
    }
    legacy: {
        callsToday: number
        totalLeads: number
    }
}

export function StatsOverview({ overview, legacy }: StatsOverviewProps) {
    const conversionRate = `${overview.summary.conversionRate.toFixed(1)}%`
    const interestRate = `${overview.summary.interestRate.toFixed(1)}%`

    return (
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
    )
}
