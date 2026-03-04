/**
 * Company Research Service
 * 
 * Dynamically researches company information using OpenAI.
 * 
 * DUAL-SIDED RESEARCH:
 * 1. SELLER COMPANY (Your Company) - Research the company using this app
 *    - Used for: Knowledge Base, Scripts, AI Persona
 *    - Example: Atomicwork (the company signing up)
 * 
 * 2. PROSPECT COMPANY (Lead's Company) - Research who you're calling
 *    - Used for: Lead enrichment, contextual approach
 *    - Example: The company a lead works at
 * 
 * Generates comprehensive knowledge about:
 * - Founders and their backgrounds
 * - Funding history and investors
 * - Company history and mission
 * - Product offerings
 * - How to approach/sell to them (for prospects)
 * 
 * This replaces hardcoded company knowledge.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory cache to avoid repeated API calls for the same company
const companyKnowledgeCache = new Map();

/**
 * Research a company dynamically using OpenAI
 * @param {string} companyName - Name of the company to research
 * @returns {Object} Comprehensive company knowledge
 */
export async function researchCompany(companyName) {
    console.log(`[Company Research] Researching: ${companyName}`);

    // Check cache first
    if (companyKnowledgeCache.has(companyName.toLowerCase())) {
        console.log(`[Company Research] Cache hit for ${companyName}`);
        return companyKnowledgeCache.get(companyName.toLowerCase());
    }

    try {
        const startTime = Date.now();

        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            system: `You are a business research assistant. Provide accurate information about companies.
If you don't have specific information, provide reasonable placeholders or say "information not available".
Focus on facts that build credibility and trust with prospects. Reply ONLY with valid JSON.`,
            messages: [{
                role: 'user',
                content: `Research "${companyName}" and return JSON:

{
  "companyName": "Official company name",
  "tagline": "One-line description",
  "founded": "Year founded",
  "headquarters": "HQ location",
  "offices": ["office locations"],
  "founders": [{ "name": "Name", "role": "CEO/CTO", "background": "Brief background" }],
  "funding": {
    "totalRaised": "Total raised e.g. $40M",
    "rounds": [{ "type": "Series A", "amount": "$10M", "date": "Jan 2024", "leadInvestors": [], "otherInvestors": [] }],
    "notableInvestors": []
  },
  "product": { "category": "ITSM/CRM/etc", "description": "What it does", "keyFeatures": [], "differentiators": [], "targetCustomers": "Who uses it" },
  "mission": "Mission statement",
  "keyStats": [],
  "competitors": [],
  "whyFounded": "Origin story"
}

Be factual. Use real data for well-known companies.`
            }],
            temperature: 0.3,
            max_tokens: 1500
        });

        const elapsed = Date.now() - startTime;
        console.log(`[Company Research] Completed in ${elapsed}ms`);

        const rawText = response.content[0].text;
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const knowledge = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

        // Cache the result
        companyKnowledgeCache.set(companyName.toLowerCase(), knowledge);

        console.log(`[Company Research] Found: ${knowledge.companyName} - ${knowledge.tagline}`);
        if (knowledge.funding?.totalRaised) {
            console.log(`[Company Research] Funding: ${knowledge.funding.totalRaised}`);
        }

        return knowledge;
    } catch (error) {
        console.error('[Company Research] Error:', error.message);

        // Return minimal fallback
        return {
            companyName: companyName,
            tagline: 'A technology company',
            founded: 'Unknown',
            headquarters: 'Unknown',
            founders: [],
            funding: { totalRaised: 'Unknown', rounds: [], notableInvestors: [] },
            product: {
                category: 'Technology',
                description: 'Unknown',
                keyFeatures: [],
                differentiators: []
            },
            mission: 'Unknown',
            keyStats: [],
            whyFounded: 'Unknown'
        };
    }
}

/**
 * Format company knowledge for use in AI system prompts
 * @param {Object} knowledge - Company knowledge object from researchCompany
 * @returns {string} Formatted text for AI prompts
 */
export function formatCompanyKnowledge(knowledge) {
    if (!knowledge || !knowledge.companyName) {
        return '';
    }

    let text = `**COMPANY BACKGROUND (Use to build trust and credibility):**\n`;

    // Basic info
    if (knowledge.founded) {
        text += `- **Founded**: ${knowledge.founded}\n`;
    }
    if (knowledge.headquarters) {
        text += `- **Headquarters**: ${knowledge.headquarters}`;
        if (knowledge.offices?.length > 0) {
            text += ` (offices in ${knowledge.offices.join(', ')})`;
        }
        text += '\n';
    }

    // Founders
    if (knowledge.founders?.length > 0) {
        text += `- **Founders**:\n`;
        knowledge.founders.forEach(f => {
            text += `  * **${f.name}** (${f.role}) - ${f.background}\n`;
        });
    }

    // Funding
    if (knowledge.funding) {
        if (knowledge.funding.totalRaised && knowledge.funding.totalRaised !== 'Unknown') {
            text += `- **Total Funding**: Raised **${knowledge.funding.totalRaised}**\n`;

            if (knowledge.funding.rounds?.length > 0) {
                knowledge.funding.rounds.forEach(r => {
                    const investors = r.leadInvestors?.join(', ') || 'investors';
                    text += `  * **${r.type}${r.date ? ` (${r.date})` : ''}**: ${r.amount} led by ${investors}\n`;
                });
            }
        }

        if (knowledge.funding.notableInvestors?.length > 0) {
            text += `- **Key Investors**: ${knowledge.funding.notableInvestors.join(', ')}\n`;
        }
    }

    // Mission
    if (knowledge.mission && knowledge.mission !== 'Unknown') {
        text += `- **Mission**: "${knowledge.mission}"\n`;
    }

    // Why founded
    if (knowledge.whyFounded && knowledge.whyFounded !== 'Unknown') {
        text += `- **Why Founded**: ${knowledge.whyFounded}\n`;
    }

    // Product info
    if (knowledge.product) {
        text += `\n**PRODUCT:**\n`;
        if (knowledge.product.description) {
            text += `- ${knowledge.product.description}\n`;
        }
        if (knowledge.product.keyFeatures?.length > 0) {
            text += `- **Key Features**: ${knowledge.product.keyFeatures.join(', ')}\n`;
        }
        if (knowledge.product.differentiators?.length > 0) {
            text += `- **Differentiators**: ${knowledge.product.differentiators.join(', ')}\n`;
        }
    }

    // Key stats
    if (knowledge.keyStats?.length > 0) {
        text += `- **Key Stats**: ${knowledge.keyStats.join('; ')}\n`;
    }

    // Add prompt for how to use this info
    text += `
**IF PROSPECT ASKS "Who are you?" or "Tell me about your company":**
Use the above information to give a credible, concise answer. Mention founders' backgrounds and funding to build trust.`;

    return text;
}

/**
 * Get cached company knowledge or null if not cached
 */
export function getCachedCompanyKnowledge(companyName) {
    return companyKnowledgeCache.get(companyName.toLowerCase()) || null;
}

/**
 * Clear company knowledge cache
 */
export function clearCompanyCache() {
    companyKnowledgeCache.clear();
}

// ============ PROSPECT COMPANY RESEARCH (FOR LEAD ENRICHMENT) ============

// Cache for prospect research
const prospectCompanyCache = new Map();

/**
 * Research a prospect's company for lead enrichment
 * This provides contextual information about who you're calling
 * 
 * @param {string} prospectCompanyName - Name of the lead's company
 * @param {string} sellerCompanyDescription - Brief description of what you (seller) do
 * @param {string} leadRole - The lead's role/title
 * @returns {Object} Prospect company research with sales approach
 */
export async function researchProspectCompany(prospectCompanyName, sellerCompanyDescription = '', leadRole = '') {
    console.log(`[Prospect Research] Researching: ${prospectCompanyName}`);

    const cacheKey = `${prospectCompanyName.toLowerCase()}_${leadRole.toLowerCase()}`;

    // Check cache first
    if (prospectCompanyCache.has(cacheKey)) {
        console.log(`[Prospect Research] Cache hit for ${prospectCompanyName}`);
        return prospectCompanyCache.get(cacheKey);
    }

    try {
        const startTime = Date.now();

        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            system: `You are a sales intelligence researcher. Research companies to help sales reps have better, more contextual conversations. Reply ONLY with valid JSON.`,
            messages: [{
                role: 'user',
                content: `Research "${prospectCompanyName}" for a sales call. Lead role: "${leadRole || 'Unknown'}".
${sellerCompanyDescription ? `Selling: ${sellerCompanyDescription}` : ''}

Return JSON:
{
  "companyName": "Official name",
  "industry": "Industry",
  "size": "Size/revenue estimate",
  "whatTheyDo": "1-2 sentence description",
  "headquarters": "HQ",
  "recentNews": [],
  "techStack": [],
  "potentialPainPoints": [],
  "talkingPoints": [],
  "approachStrategy": "How to approach",
  "competitorProducts": [],
  "buyingSignals": [],
  "objectionsPrepare": [],
  "personalization": "Specific personalisation detail"
}`
            }],
            temperature: 0.4,
            max_tokens: 1200
        });

        const elapsed = Date.now() - startTime;
        console.log(`[Prospect Research] Completed in ${elapsed}ms`);

        const rawText = response.content[0].text;
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const research = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

        // Cache the result
        prospectCompanyCache.set(cacheKey, research);

        console.log(`[Prospect Research] Found: ${research.companyName} - ${research.industry}`);

        return research;
    } catch (error) {
        console.error('[Prospect Research] Error:', error.message);

        // Return minimal fallback
        return {
            companyName: prospectCompanyName,
            industry: 'Unknown',
            size: 'Unknown',
            whatTheyDo: 'Information not available',
            potentialPainPoints: [],
            talkingPoints: [],
            approachStrategy: 'Use general discovery questions',
            personalization: ''
        };
    }
}

/**
 * Format prospect research for use in AI context during calls
 * @param {Object} research - Prospect research from researchProspectCompany
 * @returns {string} Formatted context for AI
 */
export function formatProspectResearch(research) {
    if (!research || !research.companyName) {
        return '';
    }

    let text = `\n**ABOUT THE PROSPECT'S COMPANY:**\n`;
    text += `- **Company**: ${research.companyName}\n`;

    if (research.industry) {
        text += `- **Industry**: ${research.industry}\n`;
    }
    if (research.size) {
        text += `- **Size**: ${research.size}\n`;
    }
    if (research.whatTheyDo) {
        text += `- **What they do**: ${research.whatTheyDo}\n`;
    }

    // Pain points
    if (research.potentialPainPoints?.length > 0) {
        text += `\n**POTENTIAL PAIN POINTS (Use in discovery):**\n`;
        research.potentialPainPoints.forEach(p => {
            text += `- ${p}\n`;
        });
    }

    // Talking points
    if (research.talkingPoints?.length > 0) {
        text += `\n**TALKING POINTS:**\n`;
        research.talkingPoints.forEach(t => {
            text += `- ${t}\n`;
        });
    }

    // Approach
    if (research.approachStrategy) {
        text += `\n**HOW TO APPROACH**: ${research.approachStrategy}\n`;
    }

    // Personalization
    if (research.personalization) {
        text += `\n**PERSONALIZATION TIP**: ${research.personalization}\n`;
    }

    // Objections to prepare for
    if (research.objectionsPrepare?.length > 0) {
        text += `\n**OBJECTIONS TO EXPECT**: ${research.objectionsPrepare.join('; ')}\n`;
    }

    return text;
}

/**
 * Get cached prospect research or null
 */
export function getCachedProspectResearch(companyName, role = '') {
    const cacheKey = `${companyName.toLowerCase()}_${role.toLowerCase()}`;
    return prospectCompanyCache.get(cacheKey) || null;
}

/**
 * Clear prospect research cache
 */
export function clearProspectCache() {
    prospectCompanyCache.clear();
}

