const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createUser() {
  try {
    // Hash the password
    const password = 'atomicwork123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // First, create or get the company
    let company = await prisma.company.findFirst({
      where: { slug: { startsWith: 'atomicwork' } }
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          name: 'Atomicwork',
          slug: 'atomicwork-' + Math.random().toString(36).substring(2, 8),
          plan: 'trial',
        }
      });
      console.log('✅ Company created:', company.name);

      // Create company settings
      await prisma.companySettings.create({
        data: {
          companyId: company.id,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        }
      });
      console.log('✅ Company settings created');
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'vijay@atomicwork.com' }
    });

    if (existingUser) {
      console.log('User already exists. Updating password...');
      await prisma.user.update({
        where: { email: 'vijay@atomicwork.com' },
        data: {
          password: hashedPassword,
          companyId: company.id,
          role: 'admin',
          isActive: true,
          isEmailVerified: true
        }
      });
      console.log('✅ User updated!');
    } else {
      // Create the user
      await prisma.user.create({
        data: {
          email: 'vijay@atomicwork.com',
          password: hashedPassword,
          firstName: 'Vijay',
          lastName: 'Shankar',
          companyId: company.id,
          role: 'admin',
          isActive: true,
          isEmailVerified: true
        }
      });
      console.log('✅ User created successfully!');
    }

    console.log('Email: vijay@atomicwork.com');
    console.log('Password:', password);
    console.log('Role: admin');
    console.log('\nYou can now login at /login');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
