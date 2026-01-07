
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

        user = await prisma.user.create({
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
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
