import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch phone number for a specific region (used by backend)
// This is a public endpoint for backend to call during call initiation
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')
        const region = searchParams.get('region')

        if (!userId) {
            return NextResponse.json({ error: 'userId required' }, { status: 400 })
        }

        // If region specified, find matching phone number
        if (region) {
            const normalizedRegion = region.toUpperCase().trim()

            // Direct match first
            let phoneNumber = await prisma.regionalPhoneNumber.findFirst({
                where: {
                    userId,
                    region: normalizedRegion,
                },
            })

            // If no direct match, try to find a matching region pattern
            if (!phoneNumber) {
                const allNumbers = await prisma.regionalPhoneNumber.findMany({
                    where: { userId },
                })

                // Simple matching - check if region contains any configured region code
                const regionLower = region.toLowerCase()
                phoneNumber = allNumbers.find(p => {
                    const r = p.region.toLowerCase()
                    return regionLower.includes(r) || r.includes(regionLower)
                }) || null
            }

            if (phoneNumber) {
                return NextResponse.json({ phoneNumber: phoneNumber.phoneNumber, region: phoneNumber.region })
            }
        }

        // Fall back to default number
        const defaultNumber = await prisma.regionalPhoneNumber.findFirst({
            where: { userId, isDefault: true },
        })

        if (defaultNumber) {
            return NextResponse.json({ phoneNumber: defaultNumber.phoneNumber, region: defaultNumber.region, isDefault: true })
        }

        // No configured numbers
        return NextResponse.json({ phoneNumber: null })
    } catch (error) {
        console.error('Error fetching regional phone:', error)
        return NextResponse.json({ error: 'Failed to fetch phone number' }, { status: 500 })
    }
}
