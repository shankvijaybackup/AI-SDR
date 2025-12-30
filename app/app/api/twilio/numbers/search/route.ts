import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN

export async function GET(request: NextRequest) {
    try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        if (!accountSid || !authToken) {
            return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
        }

        const { searchParams } = new URL(request.url)
        const country = searchParams.get('country') || 'US'
        const areaCode = searchParams.get('areaCode') || undefined
        const contains = searchParams.get('contains') || undefined
        const limit = parseInt(searchParams.get('limit') || '20')

        const client = twilio(accountSid, authToken)

        // Search for available phone numbers
        const numbers = await client.availablePhoneNumbers(country).local.list({
            areaCode,
            contains,
            limit,
            voiceEnabled: true,
        })

        // Format response with pricing info
        const formattedNumbers = numbers.map(number => ({
            phoneNumber: number.phoneNumber,
            friendlyName: number.friendlyName,
            locality: number.locality,
            region: number.region,
            postalCode: number.postalCode,
            isoCountry: number.isoCountry,
            capabilities: number.capabilities,
            // Pricing varies by country - approximate
            estimatedMonthlyCost: country === 'US' ? 1.00 : 2.00,
        }))

        return NextResponse.json({
            numbers: formattedNumbers,
            count: formattedNumbers.length,
            country,
        })
    } catch (error: any) {
        console.error('Search numbers error:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to search numbers' },
            { status: 500 }
        )
    }
}
