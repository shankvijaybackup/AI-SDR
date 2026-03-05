/**
 * Dynamic Call Script Generation Service
 *
 * Generates personalized call scripts based on:
 * 1. Enriched LinkedIn persona
 * 2. Lead's role and company
 * 3. Atomicwork product knowledge (RAG)
 * 4. Uploaded documents context
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generate personalized call script after lead enrichment
 */
export async function generatePersonalizedScript(lead, persona, companyContext = null) {
    try {
        console.log(`[Script] Generating personalized call script for ${lead.firstName} ${lead.lastName}`);

        // Build context from multiple sources
        const context = await buildScriptContext(lead, persona, companyContext);

        // Generate script using Claude (better at structured content)
        const script = await generateScriptWithClaude(context);

        // Save to database
        const savedScript = await saveGeneratedScript(lead.id, script, persona);

        console.log(`[Script] ✅ Personalized script generated and saved`);
        return savedScript;

    } catch (error) {
        console.error('[Script] Generation failed:', error.message);
        throw error;
    }
}

/**
 * Build comprehensive context for script generation
 */
async function buildScriptContext(lead, persona, companyContext) {
    // Extract persona insights
    const getValue = (item) => {
        if (!item) return '';
        return typeof item === 'string' ? item : (item.value || item.text || '');
    };

    const getArrayValues = (items) => {
        if (!items || !Array.isArray(items)) return [];
        return items.map(item => getValue(item)).filter(v => v);
    };

    const context = {
        // Lead information
        lead: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            fullName: `${lead.firstName} ${lead.lastName}`,
            company: lead.company,
            jobTitle: lead.jobTitle,
            industry: lead.industry || 'Technology',
            phone: lead.phone
        },

        // Persona insights
        persona: {
            discProfile: getValue(persona.discProfile),
            communicationStyle: getValue(persona.communicationStyle),
            decisionMakingStyle: getValue(persona.decisionMakingStyle),

            smartQuestions: getArrayValues(persona.strategicPrep?.smartQuestions),
            howToWin: getArrayValues(persona.internalCoaching?.howToWin),
            pitfallsAvoid: getArrayValues(persona.internalCoaching?.pitfallsAvoid),
            painPoints: getArrayValues(persona.likelyPainPoints),
            motivators: getArrayValues(persona.motivators),
            talkingPoints: getArrayValues(persona.talkingPoints),
            expectedObjections: getArrayValues(persona.expectedObjections),

            connectionAngle: getValue(persona.strategicPrep?.connectionAngle),
            roleAndFocus: getValue(persona.executiveSnapshot?.roleAndFocus)
        },

        // Atomicwork product context — keep updated with latest positioning
        product: {
            name: 'Atomicwork',
            category: 'AI-Native ITSM & ESM Platform',
            positioning: 'Built from the ground up with AI — not bolt-on. We bring IT, HR, and Finance service teams onto one unified platform.',
            valueProps: [
                'Automate up to 80% of routine employee support requests with AI',
                '10x faster ticket resolution vs legacy ITSM tools',
                '50%+ ticket deflection rate — employees self-serve in Teams/Slack',
                'Multi-modal support: Voice AI, Vision AI, Chat — employees get help how they want',
                'Deploy in weeks, not months — no rip-and-replace required'
            ],
            differentiators: [
                'AI-native from day one — not a chatbot bolted onto a legacy system',
                'Universal Agent: IT, HR, Finance all unified — one platform, one experience',
                'Employees get help in Microsoft Teams, Slack, Voice, and Vision AI — where they already work',
                'Works alongside existing tools (ServiceNow, Jira) — not a replacement',
                'Backed by Khosla Ventures and 40+ global CIOs who use and invest in us'
            ],
            foundingTeam: 'Built by the team that built Freshworks ($13B IPO) — Kiran Darisi (CTO) and Parsuram Vijayasankar (Chief Designer) are Freshworks co-founders. CEO Vijay Rayapati ran the GM division at Nutanix.',
            funding: '$40M raised — $25M Series A led by Khosla Ventures (Jan 2025). $3M from 40+ global CIOs.',
            customers: 'Pepper Money, Zuora, Structure Therapeutics, Skydio, Blackline Group, HighRadius, oOh!media, icare NSW, AVMC.',
            idealFor: [
                'Enterprises with distributed / remote service teams',
                'Companies running legacy ITSM (ServiceNow, Jira, Freshservice) with low adoption',
                'IT, HR, or Finance leaders tired of portal-first, ticket-heavy processes',
                'Organisations prioritising employee experience and AI-first operations'
            ]
        },

        // Company-specific context (if available from research)
        companyContext: companyContext || null
    };

    return context;
}

/**
 * Generate script using Claude (better at structured, nuanced content)
 */
async function generateScriptWithClaude(context) {
    const systemPrompt = `You are an expert ITSM cold call script writer following the proven "ITSM Playbook" structure.

ATOMICWORK BRAND CREDIBILITY (weave 1-2 of these in naturally — never recite as a list):
- AI-native ITSM & ESM — built from the ground up with AI, not bolted on
- Universal Agent: IT, HR, Finance all unified in one platform
- Multi-modal: Teams, Slack, Voice AI, Vision AI — employees get help where they are
- Built by the team that built Freshworks (Kiran Darisi + Parsuram Vijayasankar, co-founders)
- CEO Vijay Rayapati: Ex-Nutanix GM
- $40M raised — Series A led by Khosla Ventures, backed by 40+ global CIOs
- Customers: Pepper Money, Zuora, Structure Therapeutics, Skydio, Blackline Group, HighRadius

SCRIPT STRUCTURE — 4-PART ITSM PLAYBOOK:

1. THE OPENER (Pattern Interrupt + Permission)
   - Start with: "Hi [Name], I know I'm an interruption"
   - Get permission: "Do you have 27 seconds to tell me if I should hang up?"
   - NEVER start with company name or product pitch

2. THE HOOK (Problem-First, NOT Product-First)
   - Format: "I'm talking to [ROLE] who are [SPECIFIC PAIN POINT]"
   - Make them NOD because the pain is so specific to their role
   - End with: "Does that sound familiar?"
   - NEVER mention "ITSM" or "ticketing" — talk about the human PAIN

3. THE VALUE DRIVERS (Top 3 in this order)
   - Speed: outcomes with real numbers ("80% ticket deflection", "10x faster resolution")
   - Cost: TCO reduction, time saved, agent efficiency
   - Experience: "employees get help in Slack/Teams, not portals"
   - Add social proof with a customer name relevant to their industry

4. THE ASK (Soft Close — never hard close)
   - Use: "Would you be opposed to seeing how [company like theirs] did this?"
   - Offer choice: "2-minute video OR 15-minute call this week?"
   - NEVER ask for 30+ minutes on a cold call

CALL BEHAVIOUR RULES — ENFORCE IN EVERY SCRIPT:
- LISTEN FIRST: After asking a question, the script must pause with [Wait — listen fully]
- ONE ask only: meeting OR email, never both
- If prospect says NO or not interested: "Completely understood. Can I drop you a quick one-pager by email — no pressure at all?" Then close warmly.
- NEVER oversell or overpitch
- Be polite and consultative throughout — match the prospect's energy
- Respectful exit: "Thank you for your time, [Name]. I'll send a brief email with one customer story. Take care."

Scripts must be conversational, persona-aware, and completely natural — not robotic reading.`;

    const userPrompt = `Generate a personalized call script for this lead:

LEAD INFORMATION:
Name: ${context.lead.fullName}
Company: ${context.lead.company}
Role: ${context.lead.jobTitle}
Industry: ${context.lead.industry}

PERSONA INSIGHTS:
DISC Profile: ${context.persona.discProfile}
Communication Style: ${context.persona.communicationStyle}
Decision-Making: ${context.persona.decisionMakingStyle}

Key Pain Points:
${context.persona.painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Motivators:
${context.persona.motivators.map((m, i) => `${i + 1}. ${m}`).join('\n')}

How to Win:
${context.persona.howToWin.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Pitfalls to Avoid:
${context.persona.pitfallsAvoid.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Expected Objections:
${context.persona.expectedObjections.map((o, i) => `${i + 1}. ${o}`).join('\n')}

PRODUCT CONTEXT:
Product: ${context.product.name} — ${context.product.positioning}

Founding Team: ${context.product.foundingTeam}
Funding: ${context.product.funding}
Reference Customers: ${context.product.customers}

Key Value Props:
${context.product.valueProps.map((v, i) => `${i + 1}. ${v}`).join('\n')}

Differentiators:
${context.product.differentiators.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Ideal For:
${context.product.idealFor.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}

${context.companyContext ? `COMPANY RESEARCH:\n${JSON.stringify(context.companyContext, null, 2)}` : ''}

Generate a call script in this EXACT JSON structure (ITSM Playbook Format):

{
  "metadata": {
    "leadName": "${context.lead.fullName}",
    "company": "${context.lead.company}",
    "role": "${context.lead.jobTitle}",
    "discProfile": "${context.persona.discProfile}",
    "generatedAt": "${new Date().toISOString()}",
    "playbook": "ITSM Playbook v1.0"
  },
  "verification": {
    "confirmIdentity": "Is this ${context.lead.fullName}, ${context.lead.jobTitle} at ${context.lead.company}?"
  },
  "opener": {
    "patternInterrupt": "Hi ${context.lead.firstName}, I know I'm an interruption.",
    "permission": "Do you have 27 seconds to tell me if I should hang up?",
    "waitForResponse": "Pause and listen - they'll say 'sure' or 'what is this about'"
  },
  "hook": {
    "problemStatement": "I'm talking to [IT Directors/CIOs/Heads of IT] who are [specific pain point for their role]",
    "painExamples": [
      "Specific pain point 1 based on their role",
      "Specific pain point 2 based on their industry"
    ],
    "confirmPain": "Does that sound familiar?",
    "waitForAcknowledgment": "Listen for 'yes', 'definitely', or them sharing their pain"
  },
  "valueDrivers": {
    "intro": "Here's why I called. We're helping companies like yours:",
    "speed": {
      "metric": "Resolve 40% of tickets in under 10 seconds with AI",
      "example": "Password resets in 8 seconds, access requests auto-approved"
    },
    "cost": {
      "metric": "Cut support costs from $50 per ticket down to under $5",
      "example": "One company saved $200K/year on Tier 1 automation"
    },
    "experience": {
      "metric": "Give employees help in Slack/Teams, not clunky portals",
      "example": "87% of tickets resolved without leaving Slack"
    },
    "socialProof": "One [industry similar to theirs] company cut their ticket backlog by 60% in the first month"
  },
  "ask": {
    "softClose": "Would you be opposed to seeing how they did it?",
    "options": [
      "I can send over a 2-minute walkthrough video",
      "OR we can do a quick 15-minute call this week"
    ],
    "choiceQuestion": "Which would you prefer?"
  },
  "objectionHandling": {
    "alreadyHaveITSM": {
      "objection": "We already have ServiceNow/Jira",
      "response": "That's exactly why I called. Most of our customers had ServiceNow. The problem isn't the platform—it's that employees hate using portals. We work alongside ServiceNow. Think of us as the front door that employees actually like."
    },
    "notLooking": {
      "objection": "We're not looking right now",
      "response": "Totally fair. Most IT leaders I talk to aren't actively shopping. But if I could show you how to cut your Tier 1 workload in half in 15 minutes, would that be worth a look?"
    },
    "sendInfo": {
      "objection": "Send me some information",
      "response": "Happy to. But honestly, the best way to see this is a 2-minute demo. How about I send you a video you can watch at your desk, and if it looks interesting, we can chat? Fair?"
    },
    "noBudget": {
      "objection": "We don't have budget",
      "response": "I hear you. Most teams don't have ITSM budget sitting around. But if you're spending $200K/year on Tier 1 support, and we can cut that by half, the ROI case becomes pretty clear. Want to see the numbers?"
    },
    "notInterested": {
      "objection": "Not interested / We're good",
      "response": "Completely understood. Thank you for being upfront. Can I drop you a quick one-pager by email — one page, no pressure, just so you have it if anything changes? Then I'll stay out of your inbox."
    }
  },
  "gracefulExit": {
    "ifTheyDecline": "Completely understood, [Name]. Thank you for your time. I'll send a brief email — one customer story relevant to ${context.lead.company || 'your industry'} and the core idea. Nothing spammy. Take care.",
    "emailOffer": "Can I drop you a quick one-pager? No pressure at all — just so you have it when the timing's right.",
    "warmClose": "Really appreciate you taking the call. Have a great rest of your day."
  },
  "agentToneInstructions": {
    "discProfile": "${context.persona.discProfile}",
    "toneGuidance": "Adapt tone to DISC profile — see persona insights. Be polite and consultative throughout.",
    "communicationStyle": "${context.persona.communicationStyle}",
    "keyPrinciples": [
      "Sound human and conversational — NOT robotic or scripted",
      "Listen fully after every question — include [Wait — let them respond] pauses",
      "Match their energy and pace",
      "ONE ask per call — meeting OR email, never both",
      "If they say NO: acknowledge gracefully, offer email one-pager, close warmly",
      "Never oversell or overpitch — respect a no immediately"
    ]
  },
  "agentInstructions": {
    "tone": "Adapt tone based on DISC profile — see agentToneInstructions",
    "pacing": "Match prospect's pace — fast for D/I profiles, slower and more deliberate for S/C profiles",
    "keyReminders": [
      "Always pause and listen after asking a question",
      "Weave in 1-2 credibility points naturally (founding team, Khosla funding, customers) — never recite as a list",
      "Use specific customer names relevant to their industry",
      "Lead with pain — never lead with product features"
    ],
    "exitCriteria": [
      "POSITIVE: They agree to a call or video — confirm details warmly",
      "NEGATIVE: They decline — offer email one-pager, thank them, close warmly",
      "HARD NO: Acknowledge immediately, no pushback, graceful exit"
    ]
  }
}

Make it highly specific to ${context.lead.fullName}'s persona, role, and industry.
Use the founding team, funding, and customer references naturally — not as a list.
Be conversational and natural — this is for an AI voice agent, not a human reading a script.`;

    const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 6000,
        temperature: 0.7,
        messages: [{ role: "user", content: systemPrompt + "\n\n" + userPrompt }]
    });

    const content = message.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const script = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

    return script;
}

/**
 * Save generated script to database
 */
async function saveGeneratedScript(leadId, script, persona) {
    // In a real implementation, this would save to Prisma
    // For now, return the structured script
    return {
        id: `script_${leadId}_${Date.now()}`,
        leadId,
        script,
        persona: {
            discProfile: typeof persona.discProfile === 'string' ? persona.discProfile : persona.discProfile?.value,
            communicationStyle: typeof persona.communicationStyle === 'string' ? persona.communicationStyle : persona.communicationStyle?.value
        },
        status: 'pending_review', // Admin needs to approve
        createdAt: new Date().toISOString()
    };
}

/**
 * Generate script variations for A/B testing
 */
export async function generateScriptVariations(lead, persona, variationCount = 2) {
    const variations = [];

    for (let i = 0; i < variationCount; i++) {
        const context = await buildScriptContext(lead, persona);

        // Vary the temperature and approach for different variations
        const script = await generateScriptWithClaude(context);
        script.metadata.variation = `v${i + 1}`;

        variations.push(script);
    }

    return variations;
}

/**
 * Update script with RAG context from uploaded documents
 */
export async function enrichScriptWithRAG(script, ragDocuments) {
    if (!ragDocuments || ragDocuments.length === 0) {
        return script;
    }

    console.log(`[Script] Enriching script with ${ragDocuments.length} RAG documents`);

    // Extract relevant context from RAG documents
    const relevantContext = await extractRelevantContext(script, ragDocuments);

    // Re-generate specific sections with RAG context
    script.valueProposition.storytelling = relevantContext.customerStories || script.valueProposition.storytelling;
    script.objectionHandling.companySpecific = relevantContext.companyInfo || {};

    return script;
}

/**
 * Extract relevant context from RAG documents
 */
async function extractRelevantContext(script, ragDocuments) {
    // This would use embeddings and vector search in production
    // For now, return placeholder
    return {
        customerStories: ragDocuments.filter(d => d.type === 'case_study').map(d => d.content).join('\n\n'),
        companyInfo: ragDocuments.filter(d => d.type === 'company_research').reduce((acc, d) => ({ ...acc, ...d.data }), {})
    };
}

/**
 * Generate script flow diagram for visual preview
 */
export function generateScriptFlowDiagram(script) {
    return {
        nodes: [
            { id: 'opening', label: 'Opening & Greeting', duration: '30s', type: 'start' },
            { id: 'rapport', label: 'Rapport Building', duration: '45s', type: 'engage' },
            { id: 'discovery', label: `Discovery (${script.discovery.primaryQuestions.length} questions)`, duration: '2-3min', type: 'question' },
            { id: 'pain', label: 'Address Pain Points', duration: '1-2min', type: 'empathy' },
            { id: 'value', label: 'Present Solution', duration: '2min', type: 'pitch' },
            { id: 'objections', label: 'Handle Objections', duration: 'as-needed', type: 'handle' },
            { id: 'close', label: 'Close & Next Steps', duration: '30s', type: 'close' }
        ],
        edges: [
            { from: 'opening', to: 'rapport' },
            { from: 'rapport', to: 'discovery' },
            { from: 'discovery', to: 'pain' },
            { from: 'pain', to: 'value' },
            { from: 'value', to: 'objections' },
            { from: 'objections', to: 'close' }
        ],
        estimatedDuration: '6-8 minutes',
        adaptiveNodes: ['discovery', 'objections'] // These adapt based on conversation
    };
}

/**
 * Validate script quality before approval
 */
export function validateScript(script) {
    const issues = [];

    // Check completeness
    if (!script.opening?.greeting) issues.push('Missing opening greeting');
    if (!script.discovery?.primaryQuestions || script.discovery.primaryQuestions.length === 0) {
        issues.push('No discovery questions');
    }
    if (!script.valueProposition?.relevantFeatures || script.valueProposition.relevantFeatures.length === 0) {
        issues.push('No value proposition features');
    }
    if (!script.closing?.callToAction) issues.push('Missing call to action');

    // Check persona alignment
    if (!script.metadata?.discProfile) issues.push('No DISC profile referenced');
    if (!script.agentInstructions?.tone) issues.push('No tone guidance for agent');

    // Check for generic content (red flags)
    const genericPhrases = ['our solution', 'we offer', 'industry-leading', 'best-in-class'];
    const scriptText = JSON.stringify(script).toLowerCase();
    const genericCount = genericPhrases.filter(phrase => scriptText.includes(phrase)).length;

    if (genericCount > 2) {
        issues.push(`Script contains ${genericCount} generic phrases - needs more personalization`);
    }

    return {
        valid: issues.length === 0,
        issues,
        score: Math.max(0, 100 - (issues.length * 10)),
        quality: issues.length === 0 ? 'excellent' : issues.length < 3 ? 'good' : 'needs-work'
    };
}
