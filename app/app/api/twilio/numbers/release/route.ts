import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

export async function DELETE(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        if (!accountSid || !authToken) {
            return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        // Get the phone number from database
        const phoneNumber = await prisma.regionalPhoneNumber.findFirst({
            where: {
                id,
                userId: currentUser.userId,
                provider: 'twilio',
            },
        })

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number not found' }, { status: 404 })
        }

        if (!phoneNumber.twilioSid) {
            return NextResponse.json({ error: 'No Twilio SID found for this number' }, { status: 400 })
        }

        const client = twilio(accountSid, authToken)

        // Release the number from Twilio
        await client.incomingPhoneNumbers(phoneNumber.twilioSid).remove()

        // Delete from database
        await prisma.regionalPhoneNumber.delete({
            where: { id },
        })

        return NextResponse.json({
            success: true,
            message: `Successfully released ${phoneNumber.phoneNumber}`,
        })
    } catch (error: any) {
        console.error('Release number error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to release number' },
            { status: 500 }
        )
    }
}
