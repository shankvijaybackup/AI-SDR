const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateLeadRegions() {
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
    
    // Update all leads without a region to default to 'US'
    const result = await renderPrisma.lead.updateMany({
      where: {
        region: null
      },
      data: {
        region: 'US'
      }
    });
    
    console.log(`✅ Updated ${result.count} leads to have region 'US'`);
    
    // Verify the update
    const leadsWithoutRegion = await renderPrisma.lead.count({
      where: {
        region: null
      }
    });
    
    console.log(`Leads still without region: ${leadsWithoutRegion}`);
    
    await renderPrisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateLeadRegions();
