
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const id = '599b4f96-83ab-412b-9f4a-f1b8329f2a5f';
        const updated = await prisma.account.update({
            where: { id },
            data: {
                domain: 'firstrate.co.uk',
                linkedinUrl: 'https://www.linkedin.com/company/first-rate-exchange-services'
            }
        })
        return NextResponse.json({ success: true, account: updated })
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 })
    }
}
