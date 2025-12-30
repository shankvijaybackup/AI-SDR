import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const publicBaseUrl = process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

export async function POST(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        if (!accountSid || !authToken) {
            return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
        }

        const { phoneNumber, region } = await request.json()

        if (!phoneNumber) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
        }

        const client = twilio(accountSid, authToken)

        // Purchase the phone number
        const purchasedNumber = await client.incomingPhoneNumbers.create({
            phoneNumber,
            voiceUrl: `${publicBaseUrl}/api/twilio/voice`,
            voiceMethod: 'POST',
            statusCallback: `${publicBaseUrl}/api/twilio/status`,
            statusCallbackMethod: 'POST',
        })

        // Determine region from phone number if not provided
        let numberRegion = region
        if (!numberRegion) {
            // Auto-detect region from country code
            if (phoneNumber.startsWith('+1')) numberRegion = 'US'
            else if (phoneNumber.startsWith('+44')) numberRegion = 'UK'
            else if (phoneNumber.startsWith('+61')) numberRegion = 'ANZ'
            else if (phoneNumber.startsWith('+91')) numberRegion = 'IN'
            else numberRegion = 'OTHER'
        }

        // Save to database
        const savedNumber = await prisma.regionalPhoneNumber.create({
            data: {
                userId: currentUser.userId,
                region: numberRegion.toUpperCase(),
                phoneNumber: purchasedNumber.phoneNumber,
                provider: 'twilio',
                twilioSid: purchasedNumber.sid,
                capabilities: purchasedNumber.capabilities as any,
                monthlyCost: parseFloat(purchasedNumber.phoneNumber.startsWith('+1') ? '1.00' : '2.00'),
                isDefault: false,
            },
        })

        return NextResponse.json({
            success: true,
            phoneNumber: savedNumber,
            message: `Successfully purchased ${purchasedNumber.phoneNumber}`,
        })
    } catch (error: any) {
        console.error('Purchase number error:', error)

        // Handle specific Twilio errors
        if (error.code === 21422) {
            return NextResponse.json(
                { error: 'Phone number is not available for purchase' },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: error.message || 'Failed to purchase number' },
            { status: 500 }
        )
    }
}
