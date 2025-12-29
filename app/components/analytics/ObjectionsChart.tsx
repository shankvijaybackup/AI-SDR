'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ObjectionsChartProps {
    data: Array<{ objection: string; count: number }>
}

export function ObjectionsChart({ data }: ObjectionsChartProps) {
    // Sort data desc by count
    const sortedData = [...data]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // Top 5

    return (
        <Card>
            <CardHeader>
                <CardTitle>Top Objections</CardTitle>
                <CardDescription>Most common reasons for rejection</CardDescription>
            </CardHeader>
            <CardContent>
                {sortedData.length === 0 ? (
                    <div className="flex items-center justify-center h-64 text-slate-500">
                        No objections recorded yet
                    </div>
                ) : (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sortedData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="objection"
                                    type="category"
                                    width={150}
                                    tick={{ fontSize: 12 }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" fill="#f87171" radius={[0, 4, 4, 0]}>
                                    {sortedData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={`hsl(0, 70%, ${60 + (index * 5)}%)`} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
