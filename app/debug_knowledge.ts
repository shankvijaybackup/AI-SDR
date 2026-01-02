
import { prisma } from './lib/prisma'

async function debug() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'vijay@atomicwork.com' } })
        if (!user) {
            console.log('User not found')
            return
        }
        console.log('User:', user.id)

        const sources = await prisma.knowledgeSource.findMany({
            where: { userId: user.id }
        })
        console.log(`Found ${sources.length} sources for user ${user.id}`)
        sources.forEach(s => {
            console.log(`- [${s.id}] ${s.title} (Status: ${s.status}, Type: ${s.type}, Content Length: ${s.content?.length})`)
        })

        // Check for "completed" specifically
        const completed = await prisma.knowledgeSource.findMany({
            where: { userId: user.id, status: 'completed' }
        })
        console.log(`Found ${completed.length} 'completed' sources`)

        // Check if sources are linked to Company instead?
        if (user.companyId) {
            const companySources = await prisma.knowledgeSource.findMany({
                where: { companyId: user.companyId }
            })
            console.log(`Found ${companySources.length} sources for company ${user.companyId}`)
        }

    } catch (e) {
        console.error(e)
    }
}

debug()
