
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getCurrentUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params

        const account = await prisma.account.findUnique({
            where: { id }
        })

        if (!account || (account.companyId && account.companyId !== user.companyId)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        console.log(`Enriching account ${account.name}...`)

        const enrichmentData = {
            description: `Leading company in the ${account.industry || 'tech'} sector.`,
            specialties: ['Innovation', 'Technology', 'Services'],
            employees: '1000+',
            headquarters: account.location || 'Unknown'
        }

        const updated = await prisma.account.update({
            where: { id },
            data: {
                enriched: true,
                enrichmentData
            }
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Error enriching account:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
