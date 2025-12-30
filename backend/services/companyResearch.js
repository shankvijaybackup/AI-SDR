/**
 * Company Research Service
 * 
 * Dynamically researches company information using OpenAI.
 * Generates comprehensive knowledge about:
 * - Founders and their backgrounds
 * - Funding history and investors
 * - Company history and mission
 * - Product offerings
 * 
 * This replaces hardcoded company knowledge.
 */

import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

        const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a business research assistant. Provide accurate, up-to-date information about companies. 
          If you don't have specific information, provide reasonable placeholders or say "information not available".
          Focus on facts that build credibility and trust with prospects.`
                },
                {
                    role: 'user',
                    content: `Research the company "${companyName}" and provide comprehensive information in JSON format:

{
  "companyName": "Official company name",
  "tagline": "One-line description of what they do",
  "founded": "Year founded",
  "headquarters": "HQ location",
  "offices": ["List of office locations"],
  "founders": [
    {
      "name": "Founder name",
      "role": "CEO/CTO/CPO",
      "background": "Brief background - previous companies, experience, achievements"
    }
  ],
  "funding": {
    "totalRaised": "Total amount raised (e.g., $40 million)",
    "rounds": [
      {
        "type": "Seed/Series A/etc",
        "amount": "Amount raised",
        "date": "Month Year",
        "leadInvestors": ["Lead investor names"],
        "otherInvestors": ["Other investor names"]
      }
    ],
    "notableInvestors": ["List of notable investors"]
  },
  "product": {
    "category": "Product category (e.g., ITSM, CRM, etc.)",
    "description": "What the product does",
    "keyFeatures": ["Key feature 1", "Key feature 2"],
    "differentiators": ["What makes it unique"],
    "targetCustomers": "Who uses it"
  },
  "mission": "Company mission statement",
  "keyStats": ["Notable statistics like customers, employees, etc."],
  "competitors": ["Main competitors"],
  "whyFounded": "Story of why the company was founded"
}

Be factual and specific. If this is a well-known company, provide real data. If unknown, generate reasonable information based on the name.`
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3, // Lower temperature for more factual responses
            max_tokens: 1500
        });

        const elapsed = Date.now() - startTime;
        console.log(`[Company Research] Completed in ${elapsed}ms`);

        const knowledge = JSON.parse(response.choices[0].message.content);

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
