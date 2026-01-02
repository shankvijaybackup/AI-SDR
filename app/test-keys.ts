
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testKeys() {
    console.log('--- API Key Diagnostics ---');

    // 1. Test OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
        console.log('❌ OpenAI: Key NOT FOUND in environment.');
    } else {
        console.log(`ℹ️  OpenAI: Key found (${openaiKey.slice(0, 8)}...)`);
        try {
            const openai = new OpenAI({ apiKey: openaiKey });
            const start = Date.now();
            await openai.chat.completions.create({
                model: 'gpt-3.5-turbo', // Use cheap model for test
                messages: [{ role: 'user', content: 'ping' }],
                max_tokens: 5
            });
            console.log(`✅ OpenAI: Success! (${Date.now() - start}ms)`);
        } catch (error: any) {
            console.log(`❌ OpenAI: FAILED. Error: ${error.status || 'Unknown'} - ${error.message}`);
            if (error.code === 'insufficient_quota' || error.status === 429) {
                console.log('   -> CAUSE: Quota exceeded. Check billing at https://platform.openai.com/settings/organization/billing');
            }
        }
    }

    console.log('\n---------------------------\n');

    // 2. Test Gemini
    const geminiKey = process.env.GOOGLE_AI_API_KEY;
    if (!geminiKey) {
        console.log('❌ Gemini: Key NOT FOUND in environment.');
    } else {
        console.log(`ℹ️  Gemini: Key found (${geminiKey.slice(0, 8)}...)`);
        try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const start = Date.now();
            await model.generateContent('ping');
            console.log(`✅ Gemini: Success! (${Date.now() - start}ms)`);
        } catch (error: any) {
            console.log(`❌ Gemini: FAILED. Error: ${error.message}`);
        }
    }

    console.log('--- End Diagnostics ---');
}

testKeys().catch(console.error);
