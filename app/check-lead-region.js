const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLeadRegion() {
  try {
    // Use Render database URL
    const renderDbUrl = 'postgresql://neondb_owner:npg_d40qbEBPceyg@ep-still-breeze-a4ms76zx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
    
    // Create new Prisma client with Render DB
    const renderPrisma = new PrismaClient({
      datasources: {
        db: {
          url: renderDbUrl
        }
      }
    });
    
    // Check all leads and their regions
    const leads = await renderPrisma.lead.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        region: true,
        phone: true
      },
      take: 5
    });
    
    console.log('\n=== Checking Lead Regions ===');
    leads.forEach(lead => {
      console.log(`${lead.firstName} ${lead.lastName}: Region = ${lead.region || 'NULL'}`);
    });
    
    // Count leads without regions
    const leadsWithoutRegion = await renderPrisma.lead.count({
      where: {
        region: null
      }
    });
    
    console.log(`\nTotal leads without region: ${leadsWithoutRegion}`);
    
    await renderPrisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLeadRegion();
