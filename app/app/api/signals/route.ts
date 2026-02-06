
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
    try {
        const user = getCurrentUserFromRequest(request)
        if (!user || !user.companyId) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const signals = await prisma.marketSignal.findMany({
            where: {
                topic: {
                    companyId: user.companyId
                }
            },
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: { topic: true }
        })

        return NextResponse.json(signals)
    } catch (error) {
        console.error("[SIGNALS_GET]", error)
        return new NextResponse("Internal Error", { status: 500 })
    }
}
