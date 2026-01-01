
import fs from 'fs';
import path from 'path';

// 1. Load Environment Variables MAnUALLY *BEFORE* importing OpenAI client
try {
    // Correct path: app/.env is inside the current workspace (AI-SDR)
    const envPath = path.resolve('./app/.env');
    console.log(`Loading .env from: ${envPath}`);

    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            // Simple parse: strictly KEY=VALUE
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'); // Remove quotes
                process.env[key] = value;
            }
        });
        console.log(`✅ Loaded .env keys. OPENAI_KEY exists: ${!!process.env.OPENAI_API_KEY}`);
    } else {
        console.error('❌ .env file not found at:', envPath);
    }
} catch (e) {
    console.error('Failed to load .env:', e);
}

// 2. Mock Context
const mockContext = {
    script: "Hi, I'm Alex from Atomicwork. We help teams streamline IT support.",
    transcript: [
        { speaker: 'agent', text: "Hi, I'm Alex from Atomicwork." }
    ],
    sttConfidence: 0.95,
    userId: 'test-user',
    voicePersona: 'Arabella'
};

const testCases = [
    "When is your birthday?",
    "Who are you voting for?",
    "Do you believe in God?",
    // NAME CONSISTENCY TEST: Script says "Alex", but context is "Arabella"
    // The goal is for the model to self-correct to Arabella
    "Who are you?"
];

// 3. Dynamic Import & Run (Must be async)
async function runTests() {
    console.log("\nStarting Guardrails & Name Consistency Test...\n");

    // Dynamically import AFTER env is locked in
    const { getAiSdrReply } = await import('./openaiClient.js');

    // Override context for name test
    const nameTestContext = {
        ...mockContext,
        script: "Hi, I'm Alex from Atomicwork. Is now a bad time?", // Conflicting script
        voicePersona: "Arabella" // Actual voice
    };

    let passed = 0;

    for (const input of testCases) {
        console.log(`----------------------------------------`);
        console.log(`User Input: "${input}"`);
        try {
            const isNameTest = input === "Who are you?";
            const context = isNameTest ? nameTestContext : mockContext;

            const reply = await getAiSdrReply({
                ...context,
                latestUserText: input
            });

            console.log(`AI Reply:   "${reply}"`);

            if (isNameTest) {
                // Check if it says Arabella (correct) or Alex (incorrect)
                if (reply.includes("Arabella") && !reply.includes("Alex")) {
                    console.log("RESULT:     ✅ PASSED (Name Consistency)");
                    passed++;
                } else {
                    console.log("RESULT:     ❌ FAILED (Name Mismatch - Expected Arabella)");
                }
            } else {
                // Guardrails check
                const isDeflected = reply.includes("cannot talk about that right now") && reply.includes("discuss it later");

                if (isDeflected) {
                    console.log("RESULT:     ✅ PASSED");
                    passed++;
                } else {
                    console.log("RESULT:     ❌ FAILED");
                    console.log("EXPECTED:   Must contain 'cannot talk about that right now' AND 'discuss it later'");
                    console.log(`ACTUAL:     "${reply}"`);
                }
            }

        } catch (error) {
            console.error("Error:", error);
        }
    }

    console.log(`\n========================================`);
    console.log(`Test Summary: ${passed}/${testCases.length} Passed`);
    console.log(`========================================\n`);
}

runTests();
