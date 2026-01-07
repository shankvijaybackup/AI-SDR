
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'vijay@atomicwork.com';
    console.log(`Checking user: ${email}`);

    let user = await prisma.user.findUnique({
        where: { email },
        include: { company: true }
    });

    if (!user) {
        console.log('User not found. Creating...');
        // Create company first
        const company = await prisma.company.create({
            data: {
                name: 'Atomicwork',
                slug: 'atomicwork-' + Date.now(),
                plan: 'starter'
            }
        });

        await prisma.user.create({
            data: {
                email,
                password: 'test', // hash properly in real app
                firstName: 'Vijay',
                lastName: 'Rayapati',
                role: 'admin',
                companyId: company.id,
                isActive: true
            },
            include: { company: true }
        });
        console.log('User created with company.');
    } else {
        console.log('User found:', user.id);
        if (!user.companyId) {
            console.log('User has no company. Creating/Linking...');
            const company = await prisma.company.create({
                data: {
                    name: 'Atomicwork',
                    slug: 'atomicwork-' + Date.now(),
                    plan: 'starter'
                }
            });
            await prisma.user.update({
                where: { id: user.id },
                data: { companyId: company.id, isActive: true }
            });
            console.log('User linked to new company.');
        } else {
            console.log('User already has company:', user.companyId);
            // Ensure active
            if (!user.isActive) {
                await prisma.user.update({ where: { id: user.id }, data: { isActive: true } });
                console.log("User activated.");
            }
        }
    }

    // Seed Scenarios
    console.log("Seeding scenarios...");
    const scenarios = [
        {
            title: "Discovery Call with Skeptical CTO",
            description: "Structure a discovery call with a technical buyer who doubts AI ROI.",
            personaName: "Marcus Chen",
            personaRole: "CTO",
            difficulty: "hard",
            objectives: ["Uncover technical pain points", "Address security concerns", "Schedule technical demo"]
        },
        {
            title: "Renewal Negotiation with Procurement",
            description: "Handle a tough renewal conversation where budget is being cut.",
            personaName: "Sarah Jones",
            personaRole: "Procurement Manager",
            difficulty: "medium",
            objectives: ["Defend pricing", "Highlight usage value", "Secure annual commit"]
        },
        {
            title: "Inbound Lead Qualification",
            description: "Qualify an inbound lead who visited the pricing page.",
            personaName: "David Miller",
            personaRole: "VP of Sales",
            difficulty: "easy",
            objectives: ["BANT Qualification", "Identify decision process", "Book meeting"]
        }
    ];

    for (const s of scenarios) {
        // Check if exists
        const exists = await prisma.roleplayScenario.findFirst({
            where: { title: s.title }
        });

        if (!exists) {
            await prisma.roleplayScenario.create({
                data: {
                    ...s,
                    // Link to company if user exists
                    companyId: user?.companyId
                }
            });
            console.log(`Created scenario: ${s.title}`);
        } else {
            console.log(`Scenario exists: ${s.title}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
