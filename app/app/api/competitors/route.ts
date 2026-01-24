
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { getCurrentUser } from '@/lib/auth'

// GET: List topics
export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const topics = await prisma.marketingTopic.findMany({
            where: { companyId: user.companyId },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { signals: true } } }
        })

        // Map to expected frontend format (temporary adapter)
        const competitors = topics.map(t => ({
            id: t.id,
            name: t.keyword,
            domain: t.type, // reusing domain field for type
            postCount: t._count.signals,
            lastScrapedAt: t.updatedAt
        }))

        return NextResponse.json(competitors)
    } catch (error) {
        console.error("[TOPICS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}

// POST: Add topic
export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user || !user.companyId) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const body = await req.json()
        const { name, type = "COMPETITOR" } = body // Frontend sends 'name' as keyword

        if (!name) {
            return new NextResponse("Keyword is required", { status: 400 })
        }

        const topic = await prisma.marketingTopic.create({
            data: {
                companyId: user.companyId,
                keyword: name,
                type: type // 'MY_BRAND', 'COMPETITOR', etc.
            }
        })

        return NextResponse.json(topic)
    } catch (error) {
        console.error("[TOPICS_POST]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
