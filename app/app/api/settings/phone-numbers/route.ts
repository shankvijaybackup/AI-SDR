import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// GET - List user's regional phone numbers
export async function GET() {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const phoneNumbers = await prisma.regionalPhoneNumber.findMany({
            where: { userId: currentUser.userId },
            orderBy: [{ isDefault: 'desc' }, { region: 'asc' }],
        })

        return NextResponse.json({ phoneNumbers })
    } catch (error) {
        console.error('Error fetching phone numbers:', error)
        return NextResponse.json({ error: 'Failed to fetch phone numbers' }, { status: 500 })
    }
}

// POST - Add or update a regional phone number
export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const { region, phoneNumber, isDefault } = await request.json()

        if (!region || !phoneNumber) {
            return NextResponse.json({ error: 'Region and phone number are required' }, { status: 400 })
        }

        // Validate phone number format (basic validation)
        const cleanPhone = phoneNumber.replace(/\s/g, '')
        if (!cleanPhone.startsWith('+') || cleanPhone.length < 10) {
            return NextResponse.json({ error: 'Phone number must be in E.164 format (e.g., +14155551234)' }, { status: 400 })
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await prisma.regionalPhoneNumber.updateMany({
                where: { userId: currentUser.userId, isDefault: true },
                data: { isDefault: false },
            })
        }

        // Find existing phone number for this user and region
        const existing = await prisma.regionalPhoneNumber.findFirst({
            where: {
                userId: currentUser.userId,
                region: region.toUpperCase(),
            },
        })

        let result
        if (existing) {
            // Update existing
            result = await prisma.regionalPhoneNumber.update({
                where: { id: existing.id },
                data: {
                    phoneNumber: cleanPhone,
                    isDefault: isDefault || false,
                },
            })
        } else {
            // Create new
            result = await prisma.regionalPhoneNumber.create({
                data: {
                    userId: currentUser.userId,
                    region: region.toUpperCase(),
                    phoneNumber: cleanPhone,
                    isDefault: isDefault || false,
                },
            })
        }


        return NextResponse.json({ success: true, phoneNumber: result })
    } catch (error) {
        console.error('Error saving phone number:', error)
        return NextResponse.json({ error: 'Failed to save phone number' }, { status: 500 })
    }
}

// DELETE - Remove a regional phone number
export async function DELETE(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        // Make sure user owns this record
        const record = await prisma.regionalPhoneNumber.findFirst({
            where: { id, userId: currentUser.userId },
        })

        if (!record) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        await prisma.regionalPhoneNumber.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting phone number:', error)
        return NextResponse.json({ error: 'Failed to delete phone number' }, { status: 500 })
    }
}
