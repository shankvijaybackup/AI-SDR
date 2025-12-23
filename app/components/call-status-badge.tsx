'use client'

import { cn } from '@/lib/utils'

interface CallStatusBadgeProps {
    status: 'idle' | 'preparing' | 'ringing' | 'in-progress' | 'voicemail' | 'ended' | 'no-answer' | 'busy' | 'failed'
    className?: string
}

export function CallStatusBadge({ status, className }: CallStatusBadgeProps) {
    const config = {
        'idle': {
            label: 'Ready',
            bgColor: 'bg-slate-100',
            textColor: 'text-slate-600',
            dotColor: 'bg-slate-400',
            pulse: false,
        },
        'preparing': {
            label: 'Preparing...',
            bgColor: 'bg-amber-100',
            textColor: 'text-amber-700',
            dotColor: 'bg-amber-500',
            pulse: true,
        },
        'ringing': {
            label: 'Ringing...',
            bgColor: 'bg-blue-100',
            textColor: 'text-blue-700',
            dotColor: 'bg-blue-500',
            pulse: true,
        },
        'in-progress': {
            label: 'In Progress',
            bgColor: 'bg-green-100',
            textColor: 'text-green-700',
            dotColor: 'bg-green-500',
            pulse: true,
        },
        'voicemail': {
            label: 'Voicemail',
            bgColor: 'bg-purple-100',
            textColor: 'text-purple-700',
            dotColor: 'bg-purple-500',
            pulse: false,
        },
        'ended': {
            label: 'Ended',
            bgColor: 'bg-slate-100',
            textColor: 'text-slate-600',
            dotColor: 'bg-slate-400',
            pulse: false,
        },
        'no-answer': {
            label: 'No Answer',
            bgColor: 'bg-orange-100',
            textColor: 'text-orange-700',
            dotColor: 'bg-orange-500',
            pulse: false,
        },
        'busy': {
            label: 'Busy',
            bgColor: 'bg-red-100',
            textColor: 'text-red-700',
            dotColor: 'bg-red-500',
            pulse: false,
        },
        'failed': {
            label: 'Failed',
            bgColor: 'bg-red-100',
            textColor: 'text-red-700',
            dotColor: 'bg-red-500',
            pulse: false,
        },
    }

    const { label, bgColor, textColor, dotColor, pulse } = config[status] || config['idle']

    return (
        <div className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
            bgColor,
            textColor,
            className
        )}>
            <span className="relative flex h-2.5 w-2.5">
                {pulse && (
                    <span className={cn(
                        'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                        dotColor
                    )} />
                )}
                <span className={cn(
                    'relative inline-flex rounded-full h-2.5 w-2.5',
                    dotColor
                )} />
            </span>
            {label}
        </div>
    )
}

// Large status display for prominent call status
export function CallStatusDisplay({ status, disconnectReason }: { status: string, disconnectReason?: string }) {
    const config: Record<string, { icon: string, label: string, color: string }> = {
        'idle': { icon: '📞', label: 'Ready to Call', color: 'text-slate-600' },
        'preparing': { icon: '⏳', label: 'Preparing Call...', color: 'text-amber-600' },
        'ringing': { icon: '📲', label: 'Ringing...', color: 'text-blue-600' },
        'calling': { icon: '🗣️', label: 'Call in Progress', color: 'text-green-600' },
        'in-progress': { icon: '🗣️', label: 'Call in Progress', color: 'text-green-600' },
        'voicemail': { icon: '📠', label: 'Voicemail Detected', color: 'text-purple-600' },
        'ended': { icon: '✅', label: 'Call Ended', color: 'text-slate-600' },
        'no-answer': { icon: '❌', label: 'No Answer', color: 'text-orange-600' },
        'busy': { icon: '🚫', label: 'Line Busy', color: 'text-red-600' },
        'failed': { icon: '⚠️', label: 'Call Failed', color: 'text-red-600' },
    }

    const { icon, label, color } = config[status] || config['idle']

    return (
        <div className="text-center py-4">
            <div className="text-4xl mb-2">{icon}</div>
            <div className={cn('text-lg font-semibold', color)}>{label}</div>
            {disconnectReason && (
                <div className="text-sm text-slate-500 mt-1">{disconnectReason}</div>
            )}
        </div>
    )
}
