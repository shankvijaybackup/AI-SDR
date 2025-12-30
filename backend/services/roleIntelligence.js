/**
 * Role Intelligence Service
 * 
 * Researches common challenges, pain points, and priorities
 * for specific job roles to personalize outreach.
 * 
 * Used during lead enrichment to understand:
 * - What challenges this role typically faces
 * - KPIs they care about
 * - Current industry trends affecting them
 * - Best outreach approaches
 * - Common objections to prepare for
 */

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache for role intelligence (avoid repeated API calls)
const roleIntelligenceCache = new Map();

/**
 * Research challenges and context for a specific job role
 * @param {string} role - Job title/role (e.g., "VP of Sales", "CIO", "IT Director")
 * @param {string} industry - Optional industry context
 * @param {string} companySize - Optional company size context
 * @returns {Object} Role intelligence data
 */
export async function researchRoleChallenges(role, industry = '', companySize = '') {
    if (!role) {
        return getDefaultRoleIntelligence();
    }

    const cacheKey = `${role.toLowerCase()}_${industry.toLowerCase()}_${companySize.toLowerCase()}`;

    // Check cache first
    if (roleIntelligenceCache.has(cacheKey)) {
        console.log(`[Role Intelligence] Cache hit for ${role}`);
        return roleIntelligenceCache.get(cacheKey);
    }

    console.log(`[Role Intelligence] Researching: ${role}${industry ? ` in ${industry}` : ''}`);

    try {
        const startTime = Date.now();

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are a sales intelligence expert. Research what challenges, priorities, and pain points a specific job role faces. 
Provide practical, actionable intelligence that helps sales reps have better conversations.
Be specific to 2024-2025 trends and challenges.`
                },
                {
                    role: 'user',
                    content: `Research the role: "${role}"${industry ? ` in the ${industry} industry` : ''}${companySize ? ` at a ${companySize} company` : ''}.

Provide intelligence in JSON format:

{
  "role": "Normalized role title",
  "seniority": "C-level/VP/Director/Manager/Individual Contributor",
  "department": "Sales/IT/HR/Operations/etc.",
  
  "challenges": [
    "Top challenge 1 they face today",
    "Top challenge 2",
    "Top challenge 3 (up to 5)"
  ],
  
  "kpis": [
    "KPI 1 they are measured on",
    "KPI 2 (up to 5)"
  ],
  
  "priorities": [
    "What they care most about right now",
    "Priority 2 (up to 3)"
  ],
  
  "trends": [
    "Industry trend affecting this role in 2024-2025",
    "Trend 2 (up to 3)"
  ],
  
  "outreachAngles": [
    "Best angle to approach this person",
    "Alternative angle 2",
    "What messaging resonates with them"
  ],
  
  "commonObjections": [
    "Objection 1 to prepare for",
    "Objection 2",
    "Objection 3"
  ],
  
  "discoveryQuestions": [
    "Good question to ask in discovery",
    "Question 2",
    "Question 3"
  ],
  
  "decisionMakingPower": "Final decision maker / Influencer / End user",
  "reportingTo": "Who they typically report to",
  "teamSize": "Typical team size they manage"
}

Be specific and practical. Focus on what would help a sales rep have a better conversation.`
                }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.4,
            max_tokens: 1500
        });

        const elapsed = Date.now() - startTime;
        console.log(`[Role Intelligence] Completed in ${elapsed}ms`);

        const intelligence = JSON.parse(response.choices[0].message.content);

        // Cache the result
        roleIntelligenceCache.set(cacheKey, intelligence);

        console.log(`[Role Intelligence] ${role}: ${intelligence.challenges?.length || 0} challenges, ${intelligence.kpis?.length || 0} KPIs`);

        return intelligence;
    } catch (error) {
        console.error('[Role Intelligence] Error:', error.message);
        return getDefaultRoleIntelligence(role);
    }
}

/**
 * Format role intelligence for use in AI prompts
 * @param {Object} intelligence - Role intelligence data
 * @returns {string} Formatted string for system prompts
 */
export function formatRoleIntelligence(intelligence) {
    if (!intelligence || !intelligence.role) {
        return '';
    }

    let text = `\n**ABOUT THIS ROLE (${intelligence.role}):**\n`;

    if (intelligence.seniority) {
        text += `- **Level**: ${intelligence.seniority}\n`;
    }

    if (intelligence.challenges?.length > 0) {
        text += `\n**COMMON CHALLENGES (Use in discovery):**\n`;
        intelligence.challenges.forEach(c => {
            text += `- ${c}\n`;
        });
    }

    if (intelligence.kpis?.length > 0) {
        text += `\n**KPIs THEY CARE ABOUT:**\n`;
        intelligence.kpis.forEach(k => {
            text += `- ${k}\n`;
        });
    }

    if (intelligence.outreachAngles?.length > 0) {
        text += `\n**BEST OUTREACH ANGLES:**\n`;
        intelligence.outreachAngles.forEach(a => {
            text += `- ${a}\n`;
        });
    }

    if (intelligence.discoveryQuestions?.length > 0) {
        text += `\n**DISCOVERY QUESTIONS TO ASK:**\n`;
        intelligence.discoveryQuestions.forEach(q => {
            text += `- "${q}"\n`;
        });
    }

    if (intelligence.commonObjections?.length > 0) {
        text += `\n**OBJECTIONS TO PREPARE FOR:**\n`;
        intelligence.commonObjections.forEach(o => {
            text += `- ${o}\n`;
        });
    }

    if (intelligence.decisionMakingPower) {
        text += `\n**DECISION POWER**: ${intelligence.decisionMakingPower}\n`;
    }

    return text;
}

/**
 * Get cached role intelligence or null
 */
export function getCachedRoleIntelligence(role, industry = '', companySize = '') {
    const cacheKey = `${role.toLowerCase()}_${industry.toLowerCase()}_${companySize.toLowerCase()}`;
    return roleIntelligenceCache.get(cacheKey) || null;
}

/**
 * Clear role intelligence cache
 */
export function clearRoleCache() {
    roleIntelligenceCache.clear();
}

/**
 * Get default role intelligence when API fails
 */
function getDefaultRoleIntelligence(role = 'Unknown') {
    return {
        role: role,
        seniority: 'Unknown',
        department: 'Unknown',
        challenges: [],
        kpis: [],
        priorities: [],
        trends: [],
        outreachAngles: ['Focus on solving a business problem', 'Be consultative, not salesy'],
        commonObjections: ['Not a priority right now', 'We already have a solution', 'Budget constraints'],
        discoveryQuestions: ['What are your biggest challenges right now?', 'How are you currently handling this?'],
        decisionMakingPower: 'Unknown'
    };
}
