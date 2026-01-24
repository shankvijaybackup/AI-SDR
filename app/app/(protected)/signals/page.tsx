
import { Metadata } from "next"
import { CompetitorWatchlist } from "@/components/signals/CompetitorWatchlist"
import { SignalFeed } from "@/components/signals/SignalFeed"
import { ModuleHeader } from "@/components/ui/module-header"
import { Radar } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
    title: "Competitor Signals",
    description: "Track competitor engagement and market movement.",
}

export default async function SignalsPage() {
    const user = await getCurrentUser()
    if (!user || !user.companyId) {
        redirect("/auth/login")
    }

    // Fetch initial data (MarketingTopics) and adapt to "Competitor" interface for now
    // Force rebuild check
    const topics = await prisma.marketingTopic.findMany({
        where: { companyId: user.companyId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { signals: true } } }
    })

    // Adapt to match the UI component's expected interface
    const competitors = topics.map(t => ({
        id: t.id,
        name: t.keyword,
        domain: t.type,
        postCount: t._count.signals,
        lastScrapedAt: t.updatedAt,
        linkedinId: null, // Legacy field
        linkedinUrl: null // Legacy field
    }))

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            <ModuleHeader
                title="Market Intelligence"
                subtitle="Monitor key competitors and detect when your leads engage with them."
                score={{ value: competitors.length, label: "Topics" }}
                iconNode={<Radar className="h-7 w-7 text-white" />}
            />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-3">
                    <CompetitorWatchlist competitors={competitors} />
                </div>
                <div className="col-span-4">
                    <SignalFeed />
                </div>
            </div>
        </div>
    )
}
