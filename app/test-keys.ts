
import Anthropic from '@anthropic-ai/sdk';

async function testKeys() {
    console.log('--- API Key Diagnostics ---');

    // 1. Test Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
        console.log('❌ Anthropic: Key NOT FOUND in environment.');
    } else {
        console.log(`ℹ️  Anthropic: Key found (${anthropicKey.slice(0, 8)}...)`);
        try {
            const client = new Anthropic({ apiKey: anthropicKey });
            const start = Date.now();
            await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 5,
                messages: [{ role: 'user', content: 'ping' }],
            });
            console.log(`✅ Anthropic: Success! (${Date.now() - start}ms)`);
        } catch (error: any) {
            console.log(`❌ Anthropic: FAILED. Error: ${error.status || 'Unknown'} - ${error.message}`);
        }
    }

    console.log('\n---------------------------\n');

    // 2. Test Groq
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
        console.log('❌ Groq: Key NOT FOUND in environment.');
    } else {
        console.log(`ℹ️  Groq: Key found (${groqKey.slice(0, 8)}...)`);
        try {
            // Dynamic import to keep dependency optional at this point
            const Groq = (await import('groq-sdk')).default;
            const groq = new Groq({ apiKey: groqKey });
            const start = Date.now();
            await groq.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 1,
            });
            console.log(`✅ Groq: Success! (${Date.now() - start}ms)`);
        } catch (error: any) {
            console.log(`❌ Groq: FAILED. Error: ${error.message}`);
        }
    }

    console.log('\n---------------------------\n');

    // 3. Test Voyage AI
    const voyageKey = process.env.VOYAGE_API_KEY;
    if (!voyageKey) {
        console.log('❌ Voyage AI: Key NOT FOUND in environment.');
    } else {
        console.log(`ℹ️  Voyage AI: Key found (${voyageKey.slice(0, 8)}...)`);
        try {
            const { VoyageAIClient } = await import('voyageai');
            const client = new VoyageAIClient({ apiKey: voyageKey });
            const start = Date.now();
            await client.embed({ input: ['ping'], model: 'voyage-3' });
            console.log(`✅ Voyage AI: Success! (${Date.now() - start}ms)`);
        } catch (error: any) {
            console.log(`❌ Voyage AI: FAILED. Error: ${error.message}`);
        }
    }

    console.log('--- End Diagnostics ---');
}

testKeys().catch(console.error);
