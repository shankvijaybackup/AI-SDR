
/**
 * Test Script for Deep Account Research
 * 
 * Usage: npx ts-node test_deep_research.ts
 */

import { performDeepResearch } from './app/lib/account-research';
import { prisma } from './app/lib/prisma';

async function main() {
    console.log('Running Deep Context-Aware Research Test...');

    // 1. Setup Data
    const userId = "test_user_123";
    // Need a real user ID if possible, or mock one. Since we don't know the DB state,
    // let's try to find an existing user or just rely on the fallback themes.

    // Find first user
    const user = await prisma.user.findFirst();
    const finalUserId = user ? user.userId : userId;

    // Create/Find Test Account
    const account = await prisma.account.upsert({
        where: { domain: 'clearwing.com' },
        update: {},
        create: {
            name: "Clearwing Productions",
            domain: "clearwing.com",
            industry: "Events",
            location: "Milwaukee, WI",
            ownerId: finalUserId
        }
    });

    console.log(`Using Account: ${account.name} (${account.id})`);
    console.log(`Using User ID: ${finalUserId}`);

    // 2. Run Research
    try {
        const notes = await performDeepResearch(account.id, finalUserId);

        console.log('\n=== RESEARCH RESULTS ===');
        if (notes.length === 0) {
            console.log('No notes found (Mock search might have returned nothing or LLM filtered it out).');
        } else {
            notes.forEach((n, i) => {
                console.log(`\n[${i + 1}] ${n.title}`);
                console.log(`Source: ${n.source}`);
                console.log(`Relevance: ${n.relevanceScore}/10`);
                console.log(`Tags: ${n.tags.join(', ')}`);
                console.log(`Summary: ${n.content}`);
            });
        }
    } catch (e) {
        console.error('Test Failed:', e);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
