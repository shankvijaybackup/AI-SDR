
"use client"

import { useState } from "react"
import { Plus, Trash2, Globe, Linkedin, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner" // Assuming sonner is installed or stick to useToast
import { useRouter } from "next/navigation"

interface Competitor {
    id: string
    name: string
    domain: string | null
    linkedinUrl: string | null
    linkedinId: string | null
    postCount: number
}

interface CompetitorWatchlistProps {
    competitors: Competitor[]
}

export function CompetitorWatchlist({ competitors: initialCompetitors }: CompetitorWatchlistProps) {
    const [competitors, setCompetitors] = useState<Competitor[]>(initialCompetitors)
    const [newCompetitor, setNewCompetitor] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleAdd = async () => {
        if (!newCompetitor.trim()) return

        setLoading(true)
        try {
            const res = await fetch("/api/competitors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // Simple logic: user types name or URL. We pass it as name for now, or URL if it looks like one.
                body: JSON.stringify({
                    name: newCompetitor,
                    linkedinUrl: newCompetitor.includes('linkedin.com') ? newCompetitor : undefined
                })
            })

            if (!res.ok) throw new Error("Failed to add competitor")

            const added = await res.json()
            setCompetitors([added, ...competitors])
            setNewCompetitor("")
            toast.success("Competitor added to watchlist")
            router.refresh()
        } catch (error) {
            toast.error("Could not add competitor")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Market Watchlist
                    <Badge variant="secondary" className="ml-auto">{competitors.length} Topics</Badge>
                </CardTitle>
                <CardDescription>
                    Track posts and mentions for these topics.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="Company Name or LinkedIn URL..."
                        value={newCompetitor}
                        onChange={(e) => setNewCompetitor(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <Button onClick={handleAdd} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                    {competitors.map((comp) => (
                        <div key={comp.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                            <div className="space-y-1">
                                <div className="font-medium flex items-center gap-2">
                                    {comp.name}
                                    {comp.linkedinId && <Badge variant="outline" className="text-[10px] h-4">Verified</Badge>}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    {comp.linkedinUrl && (
                                        <a href={comp.linkedinUrl} target="_blank" className="flex items-center gap-1 hover:text-primary">
                                            <Linkedin className="h-3 w-3" /> LinkedIn
                                        </a>
                                    )}
                                    {comp.postCount > 0 && (
                                        <span className="flex items-center gap-1">
                                            {comp.postCount} Posts Scanned
                                        </span>
                                    )}
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    {competitors.length === 0 && (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                            No competitors tracked yet.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
