'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

interface OutcomeDistributionProps {
    funnelData: any[]
    interestBreakdown: {
        high: number
        medium: number
        low: number
        not_interested: number
    }
}

const INTEREST_COLORS = {
    high: '#22c55e',
    medium: '#eab308',
    low: '#f97316',
    not_interested: '#ef4444',
}

export function OutcomeDistribution({ funnelData, interestBreakdown }: OutcomeDistributionProps) {
    const pieData = [
        { name: 'High Interest', value: interestBreakdown.high, color: INTEREST_COLORS.high },
        { name: 'Medium', value: interestBreakdown.medium, color: INTEREST_COLORS.medium },
        { name: 'Low', value: interestBreakdown.low, color: INTEREST_COLORS.low },
        { name: 'Not Interested', value: interestBreakdown.not_interested, color: INTEREST_COLORS.not_interested },
    ].filter(d => d.value > 0)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Conversion Funnel</CardTitle>
                    <CardDescription>Lead progression through stages</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]}>
                                    {funnelData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Interest Level Breakdown</CardTitle>
                    <CardDescription>Distribution of lead interest after calls</CardDescription>
                </CardHeader>
                <CardContent>
                    {pieData.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-slate-500">
                            No calls yet
                        </div>
                    ) : (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={3}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
