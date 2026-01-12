
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const accountSchema = z.object({
    name: z.string().min(1),
    domain: z.string().optional(),
    industry: z.string().optional(),
    annualRevenue: z.string().optional(),
    employeeCount: z.number().optional(),
    location: z.string().optional(),
    linkedinUrl: z.string().url().optional().or(z.literal('')),
})

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const search = searchParams.get('search') || searchParams.get('query') || ''
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const skip = (page - 1) * limit

        const where: any = {}

        if (user.companyId) {
            where.companyId = user.companyId
        } else {
            where.ownerId = user.userId
        }

        if (search) {
            where.name = { contains: search, mode: 'insensitive' }
        }

        const [accounts, total] = await Promise.all([
            prisma.account.findMany({
                where,
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit,
                include: {
                    _count: {
                        select: { leads: true }
                    }
                }
            }),
            prisma.account.count({ where })
        ])

        return NextResponse.json({
            data: accounts,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        })
    } catch (error) {
        console.error('Error fetching accounts:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        const validation = accountSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.format() }, { status: 400 })
        }

        const { name, domain, industry, annualRevenue, employeeCount, location, linkedinUrl } = validation.data

        const account = await prisma.account.create({
            data: {
                companyId: user.companyId,
                ownerId: user.userId,
                name,
                domain,
                industry,
                annualRevenue,
                employeeCount,
                location,
                linkedinUrl
            }
        })

        return NextResponse.json(account)
    } catch (error) {
        console.error('Error creating account:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
