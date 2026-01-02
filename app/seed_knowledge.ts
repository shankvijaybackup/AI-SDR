
import { prisma } from './lib/prisma'

async function seed() {
    try {
        const user = await prisma.user.findUnique({ where: { email: 'vijay@atomicwork.com' } })
        if (!user) {
            console.log('User not found')
            return
        }

        console.log('Seeding data for user:', user.id)

        // Create a sample knowledge source
        const source = await prisma.knowledgeSource.create({
            data: {
                userId: user.id,
                title: 'Atomicwork Product Overview',
                description: 'General overview of Atomicwork AI capabilities',
                type: 'text',
                content: `
                    Atomicwork is a modern service management platform that empowers employees and IT teams.
                    
                    Key Features:
                    1. AI-powered conversational interface (Atom) for Slack and Teams.
                    2. Automated ticket resolution for common IT and HR queries.
                    3. Seamless integration with Okta, Jamf, and other enterprise tools.
                    
                    Value Proposition:
                    - Reduce MTTR (Mean Time To Resolution) by 50%.
                    - Deflect 40% of L1 tickets automatically.
                    - Improve employee experience with instant answers.
                    
                    Customer Story:
                    A fast-growing tech unicorn used Atomicwork to onboard 500 employees in one month with zero IT backlog.
                `,
                status: 'completed',
                tags: ['product', 'overview'],
                category: 'product'
            }
        })

        console.log('Created source:', source.id)

        // Create another one
        const source2 = await prisma.knowledgeSource.create({
            data: {
                userId: user.id,
                title: 'Objection Handling - Pricing',
                description: 'How to handle pricing objections',
                type: 'text',
                content: `
                    Objection: "Your solution is too expensive."
                    
                    Response:
                    "I understand budget is a concern. However, let's look at the ROI. Atomicwork replaces legacy tools that charge per-agent, whereas we charge based on value and include unlimited agent seats.
                    
                    Data point:
                    Our customers typically save 30% on total cost of ownership (TCO) within the first year by consolidating tools and reducing agent workload.
                `,
                status: 'completed',
                tags: ['objection', 'sales'],
                category: 'sales'
            }
        })
        console.log('Created source:', source2.id)

    } catch (e) {
        console.error(e)
    }
}

seed()
