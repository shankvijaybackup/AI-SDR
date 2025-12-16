const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function activateUser() {
  try {
    const user = await prisma.user.update({
      where: { email: 'vijay@atomicwork.com' },
      data: { isActive: true }
    });
    
    console.log('✅ User activated successfully!');
    console.log('Email:', user.email);
    console.log('Active:', user.isActive);
    console.log('Email Verified:', user.isEmailVerified);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

activateUser();
