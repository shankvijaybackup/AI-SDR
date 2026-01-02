
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createUser() {
    const email = 'vijay@atomicwork.com';
    const password = 'atomicwork123';
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
            },
            create: {
                email,
                password: hashedPassword,
                firstName: 'Vijay',
                lastName: 'Rayapati', // Guessing last name or leaving blank
                role: 'user', // Default role
            },
        });

        console.log(`User ${email} created/updated successfully.`);
        console.log(user);
    } catch (error) {
        console.error('Error creating user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createUser();
