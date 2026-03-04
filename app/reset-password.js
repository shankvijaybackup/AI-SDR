// Reset Admin Password
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
    try {
        const user = await prisma.user.findUnique({
            where: { email: 'admin@atomicwork.com' }
        });

        if (!user) {
            console.log('❌ User not found');
            return;
        }

        // Simple password without special characters
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        });

        console.log('✅ Password reset successfully!');
        console.log('\n🔐 New credentials:');
        console.log('   Email: admin@atomicwork.com');
        console.log('   Password: admin123');
        console.log('\n🌐 Login at: http://localhost:3000/login');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword();
