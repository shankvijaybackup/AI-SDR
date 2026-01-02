
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkUser() {
    const email = 'vijay@atomicwork.com';
    const password = 'atomicwork123';

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            console.log(`User ${email} not found.`);
            return;
        }

        console.log(`User found:`, user);

        // Check password if your schema has a password field
        // Adjust field name if it's different (e.g. passwordHash)
        if (user.password) {
            const isMatch = await bcrypt.compare(password, user.password);
            console.log(`Password match for '${password}': ${isMatch}`);
        } else {
            console.log('User has no password set (possibly only magic link/SSO? or different field name)');
        }

    } catch (error) {
        console.error('Error checking user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
