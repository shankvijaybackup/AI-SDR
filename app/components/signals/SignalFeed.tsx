'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Zap, ExternalLink, Linkedin, MessageCircle, Info } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface Signal {
    id: string
    type: string // POST, MENTION
    source: string // LINKEDIN, REDDIT
    content: string
    url: string
    author: string
    createdAt: string
    topic: {
        keyword: string
        type: string
    }
}

export function SignalFeed() {
    const [scanning, setScanning] = useState(false)
    const [signals, setSignals] = useState<Signal[]>([])
    const [loading, setLoading] = useState(true)

    const fetchSignals = async () => {
        try {
            const res = await fetch('/api/signals')
            if (res.ok) {
                const data = await res.json()
                setSignals(data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSignals()
    }, [])

    const handleScan = async () => {
        setScanning(true)
        toast.info("Scanning LinkedIn & Reddit...")
        try {
            const res = await fetch('/api/signals/check', { method: 'POST' })
            const data = await res.json()
            if (res.ok) {
                toast.success(data.message)
                fetchSignals()
            } else {
                toast.error("Scan failed: " + data.details)
            }
        } catch (error) {
            toast.error("Failed to connect to scan service")
        } finally {
            setScanning(false)
        }
    }

    return (
        <Card className="h-full border-primary/20 bg-primary/5 flex flex-col">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                            Live Market Intelligence
                        </CardTitle>
                        <CardDescription>
                            Real-time signals from Reddit & LinkedIn
                        </CardDescription>
                    </div>
                    <Button
                        variant="default" // Changed to default for better visibility
                        size="sm"
                        onClick={handleScan}
                        disabled={scanning}
                    >
                        {scanning ? (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Scouring Web...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Scan Now
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pr-2 space-y-4">
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground animate-pulse">Loading intelligence feed...</div>
                ) : signals.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg bg-background/50">
                        <Info className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">No signals detected yet</p>
                        <p className="text-xs text-muted-foreground mt-1 px-4">
                            Add topics/competitors to the watchlist and click "Scan Now" to fetch real-time data.
                        </p>
                    </div>
                ) : (
                    signals.map((signal) => (
                        <div key={signal.id} className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors space-y-3 shadow-sm">
                            {/* Header: Source & Time */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {signal.source === 'LINKEDIN' ? (
                                        <div className="bg-[#0077b5]/10 p-1 rounded">
                                            <Linkedin className="h-3 w-3 text-[#0077b5]" />
                                        </div>
                                    ) : (
                                        <div className="bg-[#FF4500]/10 p-1 rounded">
                                            <MessageCircle className="h-3 w-3 text-[#FF4500]" />
                                        </div>
                                    )}
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                        {signal.source}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        • {formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                                <a href={signal.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1 font-medium transition-colors">
                                    View Post <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>

                            {/* Content Header: Author & Topic */}
                            <div className="text-sm">
                                <span className="font-semibold text-foreground">{signal.author || 'Unknown User'}</span>
                                <span className="text-muted-foreground"> posted about </span>
                                <span className="font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">{signal.topic.keyword}</span>
                            </div>

                            {/* Post Content Snippet */}
                            <div className="text-sm text-foreground/80 bg-muted/30 p-3 rounded-md border text-wrap break-words">
                                <p className="line-clamp-3 leading-relaxed">
                                    {signal.content}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
