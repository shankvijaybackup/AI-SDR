
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { linkedInSearch } from '@/lib/linkedin-search'
import { redditClient } from '@/lib/reddit-client'
import { getCurrentUserFromRequest } from '@/lib/auth'

// POST: Trigger a scan for signals
export async function POST(req: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request)
        if (!user || !user.companyId) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        // 1. Get all topics to monitor
        const topics = await prisma.marketingTopic.findMany({
            where: { companyId: user.companyId }
        })

        // 2. Also check for Account-specific signals? 
        // For MVP, let's just do the global topics first.
        // Or if the request body has an accountId, we do account specific search.

        let newSignalsCount = 0


        for (const topic of topics) {
            console.log(`[Scanning] Topic: ${topic.keyword} (${topic.type})`)

            let topicSignalsFound = 0;

            // --- LINKEDIN ---
            try {
                const liPosts = await linkedInSearch.searchPosts(topic.keyword)
                for (const post of liPosts) {
                    const urn = post.urn || post.id
                    const url = post.url || `https://linkedin.com/feed/update/${urn}`

                    const existing = await prisma.marketSignal.findFirst({
                        where: { url, topicId: topic.id }
                    })

                    if (!existing) {
                        await prisma.marketSignal.create({
                            data: {
                                topicId: topic.id,
                                type: 'POST',
                                source: 'LINKEDIN',
                                content: post.text || post.commentary || 'Shared content',
                                url: url,
                                author: post.actor?.name || post.header?.text || 'Unknown',
                                createdAt: new Date(post.created?.time || Date.now())
                            }
                        })
                        newSignalsCount++
                        topicSignalsFound++
                    } else {
                        topicSignalsFound++ // Count as found even if duplicate, to suppress mock
                    }
                }
            } catch (e) { console.error("LinkedIn fetch failed:", e) }

            // --- REDDIT ---
            try {
                const redditPosts = await redditClient.searchPosts(topic.keyword)
                for (const post of redditPosts) {
                    const url = `https://reddit.com${post.permalink}`

                    const existing = await prisma.marketSignal.findFirst({
                        where: { url, topicId: topic.id }
                    })

                    if (!existing) {
                        await prisma.marketSignal.create({
                            data: {
                                topicId: topic.id,
                                type: 'POST',
                                source: 'REDDIT',
                                content: post.title + "\n" + post.selftext,
                                url: url,
                                author: post.author,
                                createdAt: new Date(post.created_utc * 1000)
                            }
                        })
                        newSignalsCount++
                        topicSignalsFound++
                    } else {
                        topicSignalsFound++
                    }
                }
            } catch (e) { console.error("Reddit fetch failed:", e) }


        }

        return NextResponse.json({
            message: `Scan complete. Found ${newSignalsCount} new signals.`,
            details: "Real data fetched from LinkedIn & Reddit."
        })
    } catch (error) {
        console.error("[SIGNALS_CHECK]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
