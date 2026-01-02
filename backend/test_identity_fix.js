
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), 'app/.env') });

// Mock imports
import { getAiSdrReply } from './openaiClient.js';

async function runTest() {
    console.log('--- STARTING IDENTITY FIX VERIFICATION ---');

    console.log('\nTEST 1: Dynamic Company Identity (ProductBoard)');
    // Simulate inputs that would come from mediaStreamServer.js -> openaiClient.js
    const mockContext = {
        script: "You are Alex from ProductBoard. We help product teams understand user needs.",
        transcript: [],
        latestUserText: "Who is this?",
        sttConfidence: 0.95,
        userId: "test-user-id",
        leadEmail: "test@lead.com",
        // The critical new fields
        companyName: "ProductBoard",
        voicePersona: "Alex",
        relevantKnowledge: [
            { source: "product_docs", content: "ProductBoard is a customer-centric product management platform." }
        ]
    };

    try {
        const reply = await getAiSdrReply(mockContext);
        console.log('\n[AI Reply]:', reply);

        if (reply.toLowerCase().includes('productboard') && !reply.toLowerCase().includes('atomicwork')) {
            console.log('✅ SUCCESS: AI identified as ProductBoard and avoided Atomicwork hallucination.');
        } else {
            console.error('❌ FAILURE: AI failed to identify correctly or hallucinated Atomicwork.');
            if (reply.toLowerCase().includes('atomicwork')) console.error('   -> Found "Atomicwork" in response.');
            if (!reply.toLowerCase().includes('productboard')) console.error('   -> Did NOT find "ProductBoard" in response.');
        }

    } catch (error) {
        console.error('❌ ERROR calling getAiSdrReply:', error);
    }

    console.log('\nTEST 2: Explicit "Who are you" Question (Logic Check)');
    const companyInfoMock = {
        ...mockContext,
        latestUserText: "Tell me about your company",
    };

    try {
        const reply = await getAiSdrReply(companyInfoMock);
        console.log('\n[AI Reply]:', reply);

        if (reply.toLowerCase().includes('productboard')) {
            console.log('✅ SUCCESS: AI explained ProductBoard context.');
        } else {
            console.error('❌ FAILURE: AI failed to explain ProductBoard context.');
        }
    } catch (error) {
        console.error('❌ ERROR calling getAiSdrReply:', error);
    }

    console.log('\n--- END VERIFICATION ---');
}

runTest();
