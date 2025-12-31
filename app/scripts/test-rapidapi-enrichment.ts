
import { PrismaClient } from '@prisma/client'
import { enrichLead } from '../lib/linkedin-enrichment'
import * as dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config({ path: '.env' })

const prisma = new PrismaClient()

async function testEnrichment() {
    let testUser = null
    let testLead = null

    try {
        console.log('🔍 Testing RapidAPI Enrichment with Valid Profile...')

        // 1. Create a temporary user
        testUser = await prisma.user.create({
            data: {
                email: `test-rapidapi-${Date.now()}@test.com`,
                password: 'hash',
                firstName: 'Test',
                lastName: 'User'
            }
        })
        console.log(`✅ Created test user: ${testUser.id}`)

        // 2. Create a temporary lead with a KNOWN VALID LinkedIn URL
        // Bill Gates is usually a safe bet for public profiles
        testLead = await prisma.lead.create({
            data: {
                userId: testUser.id,
                firstName: 'Bill',
                lastName: 'Gates',
                company: 'Microsoft',
                jobTitle: 'Co-chair',
                phone: '+15551234567', // Required by schema
                linkedinUrl: 'https://www.linkedin.com/in/williamhgates'
            }
        })
        console.log(`✅ Created test lead: ${testLead.id} (Bill Gates)`)

        // 3. Trigger enrichment
        console.log('🚀 Triggering enrichment...')
        const result = await enrichLead(testLead.id, testUser.id)

        if (result) {
            // Fetch the updated lead to show the data
            const updatedLead = await prisma.lead.findUnique({
                where: { id: testLead.id }
            })

            if (updatedLead?.linkedinData) {
                const data = updatedLead.linkedinData as any
                console.log('✅ Enrichment successful!')
                console.log('📊 Enriched Data Preview:')
                console.log(`- Headline: ${data.headline}`)
                console.log(`- Location: ${data.location}`)
                console.log(`- Experience: ${data.experience?.length} roles`)
                console.log(`- Skills: ${data.skills?.slice(0, 5).join(', ')}...`)
                console.log(`- Persona DISC: ${data.persona?.discProfile}`)
            } else {
                console.error('❌ Enrichment returned true but no linkedinData found.')
            }
        } else {
            console.error('❌ Enrichment failed (returned false).')
        }

    } catch (error) {
        console.error('❌ Test failed:', error)
    } finally {
        // Cleanup
        if (testLead) {
            await prisma.lead.delete({ where: { id: testLead.id } })
            console.log('🧹 Cleaned up test lead')
        }
        if (testUser) {
            await prisma.user.delete({ where: { id: testUser.id } })
            console.log('🧹 Cleaned up test user')
        }

        await prisma.$disconnect()
    }
}

testEnrichment()
