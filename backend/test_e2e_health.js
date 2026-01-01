
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// 1. Load Environment Variables from APP
try {
    const envPath = path.resolve('./app/.env');
    console.log(`[Setup] Loading .env from: ${envPath}`);

    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                process.env[key] = value;
            }
        });
        console.log(`[Setup] ✅ .env loaded.`);
    } else {
        console.error('[Setup] ❌ .env file not found!');
        process.exit(1);
    }
} catch (e) {
    console.error('[Setup] Failed to load .env:', e);
    process.exit(1);
}

// Global Stats
let testsPassed = 0;
let testsTotal = 0;

function assert(condition, message) {
    testsTotal++;
    if (condition) {
        console.log(`✅ [PASS] ${message}`);
        testsPassed++;
    } else {
        console.error(`❌ [FAIL] ${message}`);
    }
}

async function runHealthCheck() {
    console.log(`\n================================`);
    console.log(`   AI-SDR SYSTEM HEALTH CHECK   `);
    console.log(`================================\n`);

    // --- 1. SYSTEM KEYS ---
    console.log(`\n--- 1. CONFIGURATION CHECKS ---`);
    assert(!!process.env.OPENAI_API_KEY, "OPENAI_API_KEY is present");
    assert(!!process.env.TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID is present");
    assert(!!process.env.TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN is present");
    assert(!!process.env.DATABASE_URL, "DATABASE_URL is present");

    // --- 2. DATABASE CONNECTIVITY ---
    console.log(`\n--- 2. DATABASE CONNECTIVITY ---`);
    const prisma = new PrismaClient();
    try {
        await prisma.$connect();
        assert(true, "Prisma Client connected to database");

        // Simple query
        const userCount = await prisma.user.count();
        assert(typeof userCount === 'number', `Database query successful (User count: ${userCount})`);
    } catch (e) {
        assert(false, `Database connection failed: ${e.message}`);
    } finally {
        await prisma.$disconnect();
    }

    // --- 3. AI LOGIC & GUARDRAILS (Imports Dynamic to use logic) ---
    console.log(`\n--- 3. AI LOGIC & GUARDRAILS ---`);
    try {
        process.env.USE_CACHE = 'false'; // Forced for testing
        const { getAiSdrReply } = await import('./openaiClient.js');

        const mockContext = {
            script: "Hi, I'm Alex from Atomicwork.",
            transcript: [{ speaker: 'agent', text: "Start" }],
            sttConfidence: 0.95,
            userId: 'test-user',
            voicePersona: 'Arabella'
        };

        // Test A: Name Consistency
        const nameReply = await getAiSdrReply({
            ...mockContext,
            latestUserText: "Who are you?",
            script: "Hi, I'm Alex from Atomicwork." // Trigger conflict
        });

        const nameCorrect = nameReply.includes("Arabella") && !nameReply.includes("Alex");
        assert(nameCorrect, `Name Consistency: "Alex" -> "Arabella" (Got: "${nameReply.substring(0, 50)}...")`);

        // Test B: Personal Guardrail
        const guardReply = await getAiSdrReply({
            ...mockContext,
            latestUserText: "Do you have a boyfriend?"
        });

        const deflected = guardReply.includes("cannot talk about that right now") && guardReply.includes("discuss it later");
        assert(deflected, `Guardrail Deflection: Personal question deflected correctly.`);

        // Test C: Context Injection (ITSM)
        const itsmReply = await getAiSdrReply({
            ...mockContext,
            latestUserText: "Are you a service management platform?"
        });
        const contextPass = itsmReply.toLowerCase().includes("yes") && itsmReply.toLowerCase().includes("modern ai-first itsm platform");
        assert(contextPass, `Context Truth: Confirmed ITSM platform status.`);

    } catch (e) {
        assert(false, `AI Logic Tests failed exception: ${e.message}`);
    }

    // --- 4. INTEGRATIONS LOGIC ---
    console.log(`\n--- 4. INTEGRATIONS CONFIG ---`);
    try {
        const { getAuthUrl } = await import('./hubspotClient.js');
        const authUrl = getAuthUrl('state123');
        assert(authUrl.includes('client_id='), "HubSpot Auth URL generated correctly");
        assert(authUrl.includes('redirect_uri='), "HubSpot Redirect URI included");
    } catch (e) {
        assert(false, `HubSpot Logic failed: ${e.message}`);
    }

    console.log(`\n================================`);
    console.log(`RESULTS: ${testsPassed}/${testsTotal} Passed (${Math.round(testsPassed / testsTotal * 100)}%)`);
    console.log(`================================`);

    if (testsPassed === testsTotal) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runHealthCheck();
