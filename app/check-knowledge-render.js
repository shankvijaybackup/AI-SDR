const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRenderKnowledge() {
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
    
    const sources = await renderPrisma.knowledgeSource.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`\n=== Render Knowledge Sources (${sources.length}) ===\n`);
    
    sources.forEach((source, index) => {
      console.log(`${index + 1}. ${source.title}`);
      console.log(`   Description: ${source.description || 'No description'}`);
      console.log(`   Active: ${source.isActive ? 'Yes' : 'No'}`);
      console.log(`   Created: ${source.createdAt.toLocaleString()}`);
      console.log('---');
    });
    
    // Look for AI Summit specifically
    const aiSummit = sources.find(s => 
      s.title.toLowerCase().includes('ai summit') || 
      s.description?.toLowerCase().includes('ai summit')
    );
    
    if (aiSummit) {
      console.log('\n✅ Found AI Summit content in Render database!');
    } else {
      console.log('\n❌ AI Summit content not found in Render database');
      console.log('\nYou may need to upload it through the app at: https://ai-sdr-app.onrender.com/knowledge');
    }
    
    await renderPrisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRenderKnowledge();
