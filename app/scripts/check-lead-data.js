// Check specific lead enrichment data
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkLead() {
    const lead = await prisma.lead.findFirst({
        where: { firstName: 'Vijay', lastName: 'Shankar' },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            linkedinEnriched: true,
            linkedinData: true,
        }
    })

    console.log('Lead:', lead?.firstName, lead?.lastName)
    console.log('Enriched flag:', lead?.linkedinEnriched)
    console.log('Has linkedinData:', !!lead?.linkedinData)

    if (lead?.linkedinData) {
        const data = lead.linkedinData
        console.log('Data keys:', Object.keys(data))
        console.log('Has persona:', !!data.persona)
        if (data.persona) {
            console.log('DISC:', data.persona.discProfile)
            console.log('Persona keys:', Object.keys(data.persona))
        }
    }

    await prisma.$disconnect()
}

checkLead()
