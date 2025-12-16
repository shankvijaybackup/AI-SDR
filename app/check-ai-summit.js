const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAISummit() {
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
    
    // Find the AI Summit knowledge source
    const aiSummit = await renderPrisma.knowledgeSource.findFirst({
      where: {
        title: {
          contains: 'AI Summit',
          mode: 'insensitive'
        }
      }
    });
    
    if (aiSummit) {
      console.log('Found AI Summit content:');
      console.log('Title:', aiSummit.title);
      console.log('Description:', aiSummit.description);
      console.log('Created:', aiSummit.createdAt.toLocaleString());
      
      // Note: The actual content is likely stored as a file or separate storage
      // We need to check how the knowledge content is retrieved in the RAG service
    } else {
      console.log('AI Summit content not found');
    }
    
    await renderPrisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAISummit();
