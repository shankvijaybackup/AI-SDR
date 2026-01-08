'use client'

import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
    label: string
    value: string | number
    color: string  // Tailwind gradient classes e.g. "from-blue-500 to-blue-600"
    icon: LucideIcon
    trend?: {
        value: number
        isPositive: boolean
    }
}

export function StatCard({ label, value, color, icon: Icon, trend }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Card className={`bg-gradient-to-br ${color} text-white border-0 shadow-lg hover:shadow-xl transition-shadow`}>
                <CardContent className="p-4 flex items-center justify-between">
                    <div>
                        <p className="text-white/80 text-sm font-medium">{label}</p>
                        <p className="text-2xl font-bold">{value}</p>
                        {trend && (
                            <p className={`text-xs mt-1 ${trend.isPositive ? 'text-green-200' : 'text-red-200'}`}>
                                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                            </p>
                        )}
                    </div>
                    <div className="p-3 rounded-full bg-white/20">
                        <Icon className="h-6 w-6 text-white" />
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}

// Preset color combinations
export const STAT_COLORS = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    indigo: 'from-indigo-500 to-indigo-600',
    pink: 'from-pink-500 to-pink-600',
    cyan: 'from-cyan-500 to-cyan-600',
}
