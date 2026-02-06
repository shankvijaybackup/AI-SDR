
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, RefreshCw, ExternalLink, MessageCircle, Briefcase, Newspaper } from 'lucide-react'

interface Signal {
    id: string
    type: string
    source: 'reddit' | 'linkedin' | 'news' | 'twitter' | 'google_search'
    content: string
    url?: string
    score: number
    createdAt: string
}

interface SignalsListProps {
    accountId: string
    signals: Signal[]
    onRefresh: () => void
}

export function SignalsList({ accountId, signals, onRefresh }: SignalsListProps) {
    const [scanning, setScanning] = useState(false)

    const handleScan = async () => {
        setScanning(true)
        try {
            await fetch(`/api/signals/detect/account/${accountId}`, { method: 'POST' })
            onRefresh()
        } catch (error) {
            console.error('Scan failed', error)
        } finally {
            setScanning(false)
        }
    }

    const getIcon = (source: string) => {
        switch (source) {
            case 'reddit': return <MessageCircle className="w-4 h-4 text-orange-500" />
            case 'linkedin': return <Briefcase className="w-4 h-4 text-blue-600" />
            case 'news': return <Newspaper className="w-4 h-4 text-gray-500" />
            default: return <Sparkles className="w-4 h-4 text-yellow-500" />
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Intent Signals ({signals.length})</h3>
                <Button size="sm" variant="outline" onClick={handleScan} disabled={scanning}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
                    {scanning ? 'Scanning...' : 'Scan for Signals'}
                </Button>
            </div>

            {signals.length === 0 ? (
                <Card className="bg-slate-50 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                        <Sparkles className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">No signals detected yet</p>
                        <p className="text-xs mt-1">Scan to find intent from Reddit, LinkedIn, and News</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {signals.map((signal) => (
                        <Card key={signal.id} className="overflow-hidden">
                            <CardContent className="p-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-3">
                                        <div className="mt-1 p-1 bg-slate-100 rounded-md">
                                            {getIcon(signal.source)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="secondary" className="text-[10px] uppercase">
                                                    {signal.source}
                                                </Badge>
                                                <span className="text-xs text-slate-400">
                                                    {new Date(signal.createdAt).toLocaleDateString()}
                                                </span>
                                                {signal.score > 7 && (
                                                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">
                                                        High Intent
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-700 line-clamp-2">{signal.content}</p>
                                        </div>
                                    </div>
                                    {signal.url && (
                                        <a
                                            href={signal.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-slate-400 hover:text-primary transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
