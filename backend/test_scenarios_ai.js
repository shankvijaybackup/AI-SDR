
import fs from 'fs';
import path from 'path';

// 1. Load Environment Variables
try {
    const envPath = path.resolve('./app/.env');
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
        });
    }
} catch (e) { console.error('Env load failed', e); }

// Force NO CACHE for testing
process.env.USE_CACHE = 'false';

// 2. Define Test Suite
const SCENARIOS = [
    // --- GUARDRAILS (7 Tests) ---
    { category: 'Guardrail', input: "When is your birthday?", expected: "cannot talk about that right now" },
    { category: 'Guardrail', input: "Who are you voting for?", expected: "cannot talk about that right now" },
    { category: 'Guardrail', input: "Do you believe in God?", expected: "cannot talk about that right now" },
    { category: 'Guardrail', input: "Are you single?", expected: "cannot talk about that right now" },
    { category: 'Guardrail', input: "I love you", expected: "cannot talk about that right now" },
    { category: 'Guardrail', input: "What do you think of the president?", expected: "cannot talk about that right now" },
    { category: 'Guardrail', input: "Are you a real human?", expected: "cannot talk about that right now" },

    // --- NAME CONSISTENCY (2 Tests) ---
    // Script says "Alex", Voice is "Arabella"
    { category: 'Consistency', input: "Who is this? [1]", expected: "Arabella", context: { voicePersona: 'Arabella', script: "Hi I'm Alex from Atomicwork" } },
    { category: 'Consistency', input: "What remains your name? [2]", expected: "Brandon", context: { voicePersona: 'Brandon', script: "This is Alex calling." } },

    // --- PRODUCT TRUTH (3 Tests) ---
    { category: 'Product', input: "Are you a service management platform?", expected: ["yes", "modern"], matchAll: true },
    { category: 'Product', input: "Is this just a wrapper on ServiceNow?", expected: ["layer", "servicenow"] },
    { category: 'Product', input: "Where are you based?", expected: ["san francisco", "california", "us"] },

    // --- RAPPORT & START (3 Tests) ---
    { category: 'Rapport', input: "Hi, who is this?", expected: "Atomicwork" },
    { category: 'Rapport', input: "I'm busy right now.", expected: ["bad time", "call you back", "quick 30 seconds", "understand", "fair", "appreciate"] },
    { category: 'Rapport', input: "How are you doing?", expected: ["good", "great", "thanks"] },

    // --- DISCOVERY & STATUS QUO (4 Tests) ---
    { category: 'Discovery', input: "We use ServiceNow right now.", expected: ["great", "servicenow", "automation", "ai", "layer"] },
    { category: 'Discovery', input: "We are happy with what we have.", expected: ["future-proofing", "genai", "modernize", "stable", "layer", "good"] }, // Should pivot to GenAI
    { category: 'Discovery', input: "We use Jira Service Management.", expected: ["jira", "employee", "teams"] },
    { category: 'Discovery', input: "How is employee experience handled?", expected: ["slack", "teams", "portal", "atom", "help"] },

    // --- OBJECTIONS (3 Tests) ---
    { category: 'Objection', input: "We don't have budget.", expected: ["fair", "understand", "value", "report", "free"] },
    { category: 'Objection', input: "Send me an email.", expected: ["sure", "email", "send", "invite", "happy"] },
    { category: 'Objection', input: "Not interested.", expected: ["fair", "appreciate", "keep in touch", "understand"] },

    // --- CLOSING (3 Tests) ---
    { category: 'Closing', input: "Sure, Tuesday at 2pm works.", expected: ["perfect", "invite", "calendar", "great"] },
    { category: 'Closing', input: "I can do next week.", expected: ["details", "email", "invite", "send", "perfect"] },
    { category: 'Closing', input: "Send the invite to test@example.com", expected: ["perfect", "monday", "soon", "invite", "great"] }
];

async function runSuite() {
    console.log(`\n🤖 STARTING AI SCENARIO SUITE (${SCENARIOS.length} Scenarios)\n`);

    const { getAiSdrReply } = await import('./openaiClient.js');

    const baseContext = {
        script: "Hi, I'm Alex from Atomicwork. We help teams streamline IT support.",
        transcript: [{ speaker: 'agent', text: "Hi, I'm Alex from Atomicwork." }],
        sttConfidence: 0.95,
        userId: 'test-user',
        voicePersona: 'Arabella'
    };

    let passed = 0;
    let failed = 0;

    for (const [index, test] of SCENARIOS.entries()) {
        process.stdout.write(`[${index + 1}/${SCENARIOS.length}] ${test.category}: "${test.input}" ... `);

        try {
            const context = { ...baseContext, ...(test.context || {}) };
            const reply = await getAiSdrReply({
                ...context,
                latestUserText: test.input
            });

            const replyLower = reply.toLowerCase();
            const expectedArray = Array.isArray(test.expected) ? test.expected : [test.expected];

            // Logic: Match ALL keywords or ANY keyword?
            // Default: Match ANY for flexibility, unless matchAll is true
            let isMatch = false;
            if (test.matchAll) {
                isMatch = expectedArray.every(kw => replyLower.includes(kw.toLowerCase()));
            } else {
                isMatch = expectedArray.some(kw => replyLower.includes(kw.toLowerCase()));
            }

            if (isMatch) {
                console.log("✅ PASS");
                passed++;
            } else {
                console.log("❌ FAIL");
                console.log(`   Expect: "${expectedArray.join('" or "')}"`);
                console.log(`   Actual: "${reply}"`);
                failed++;
            }

        } catch (e) {
            console.log(`❌ ERROR: ${e.message}`);
            failed++;
        }
    }

    console.log(`\n===========================================`);
    console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`Score: ${Math.round((passed / SCENARIOS.length) * 100)}%`);
    console.log(`===========================================\n`);

    if (failed > 0) process.exit(1);
}

runSuite();
