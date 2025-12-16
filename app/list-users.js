const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        // Don't include password hash in the output
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`\n=== Total Users: ${users.length} ===\n`);
    
    users.forEach((user, index) => {
      console.log(`User #${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.firstName} ${user.lastName}`);
      console.log(`  Company: ${user.company || 'N/A'}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Active: ${user.isActive ? 'Yes' : 'No'}`);
      console.log(`  Email Verified: ${user.isEmailVerified ? 'Yes' : 'No'}`);
      console.log(`  Created: ${user.createdAt.toLocaleString()}`);
      console.log(`  Last Login: ${user.lastLoginAt ? user.lastLoginAt.toLocaleString() : 'Never'}`);
      console.log('----------------------------------------');
    });
    
    // Also show raw count by role
    const roleCounts = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n=== Users by Role ===');
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`${role}: ${count}`);
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
