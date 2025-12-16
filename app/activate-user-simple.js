const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function activateUser() {
  try {
    // First check if user exists
    const user = await prisma.user.findUnique({
      where: { email: 'vijay@atomicwork.com' }
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('Current user status:');
    console.log('Email:', user.email);
    console.log('Active:', user.isActive);
    console.log('Email Verified:', user.isEmailVerified);
    
    // Update user to activate
    const updatedUser = await prisma.user.update({
      where: { email: 'vijay@atomicwork.com' },
      data: { 
        isActive: true,
        isEmailVerified: true
      }
    });
    
    console.log('\n✅ User activated successfully!');
    console.log('Active:', updatedUser.isActive);
    console.log('Email Verified:', updatedUser.isEmailVerified);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

activateUser();
