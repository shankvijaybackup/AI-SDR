'use client'

import { motion } from 'framer-motion'
import { LucideIcon, Target } from 'lucide-react'

interface ModuleHeaderProps {
    title: string
    subtitle?: string
    score?: {
        value: number
        label: string
    }
    scoreIcon?: LucideIcon
    children?: React.ReactNode  // For action buttons
}

export function ModuleHeader({
    title,
    subtitle,
    score,
    scoreIcon: ScoreIcon = Target,
    children
}: ModuleHeaderProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-between"
        >
            <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-muted-foreground mt-1">{subtitle}</p>
                )}
            </div>
            <div className="flex items-center gap-4">
                {children}
                {score && (
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">{score.label}</p>
                            <p className="text-2xl font-bold text-green-600">{score.value}%</p>
                        </div>
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/25">
                            <ScoreIcon className="h-7 w-7 text-white" />
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    )
}
