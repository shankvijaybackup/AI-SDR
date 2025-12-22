// Update LinkedIn cookie for user
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateLinkedInCookie(email, cookie) {
    try {
        const user = await prisma.user.update({
            where: { email: email },
            data: { linkedinSessionCookie: cookie }
        })

        console.log(`✅ LinkedIn cookie updated for ${email}`)
        return user
    } catch (error) {
        console.error('Error updating cookie:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

const email = process.argv[2] || 'vj@atomicwork.com'
const cookie = process.argv[3]

if (!cookie) {
    console.error('Usage: node update-linkedin-cookie.js email cookie')
    process.exit(1)
}

updateLinkedInCookie(email, cookie)
