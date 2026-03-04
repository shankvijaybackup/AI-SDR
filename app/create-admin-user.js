// Create Admin User Script
// Run: node create-admin-user.js

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdminUser() {
    try {
        console.log('🔍 Checking existing data...');

        // Check for existing company
        let company = await prisma.company.findFirst();

        if (!company) {
            console.log('📝 Creating company...');
            company = await prisma.company.create({
                data: {
                    name: 'Atomicwork',
                    slug: 'atomicwork',
                    plan: 'pro',
                    billingEmail: 'admin@atomicwork.com'
                }
            });
            console.log('✅ Company created:', company.name);
        } else {
            console.log('✅ Found existing company:', company.name);
        }

        // Check for existing admin user
        const existingUser = await prisma.user.findUnique({
            where: { email: 'admin@atomicwork.com' }
        });

        if (existingUser) {
            console.log('⚠️  User already exists: admin@atomicwork.com');
            console.log('   To reset password, delete this user in Prisma Studio first');

            // Activate user if not active
            if (!existingUser.isActive) {
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        isActive: true,
                        isEmailVerified: true
                    }
                });
                console.log('✅ User activated!');
            }

            console.log('\n🔐 Login with:');
            console.log('   Email: admin@atomicwork.com');
            console.log('   Password: Admin123!');
            return;
        }

        console.log('📝 Creating admin user...');

        // Hash password
        const hashedPassword = await bcrypt.hash('Admin123!', 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                email: 'admin@atomicwork.com',
                password: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                role: 'admin',
                companyId: company.id,
                isActive: true,
                isEmailVerified: true
            }
        });

        console.log('✅ Admin user created!');
        console.log('\n🔐 Login credentials:');
        console.log('   Email: admin@atomicwork.com');
        console.log('   Password: Admin123!');
        console.log('\n🌐 Login at: http://localhost:3000/login');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

createAdminUser()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
