const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkKnowledge() {
  try {
    const sources = await prisma.knowledgeSource.findMany({
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
    
    console.log(`\n=== Knowledge Sources (${sources.length}) ===\n`);
    
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
      console.log('\n✅ Found AI Summit content!');
    } else {
      console.log('\n❌ AI Summit content not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkKnowledge();
