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

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            system: `You are a sales intelligence expert. Provide practical, actionable role intelligence for sales reps. Reply ONLY with valid JSON.`,
            messages: [{
                role: 'user',
                content: `Research the role: "${role}"${industry ? ` in ${industry}` : ''}${companySize ? ` at a ${companySize} company` : ''}.

Return JSON:
{
  "role": "Normalized title",
  "seniority": "C-level/VP/Director/Manager/IC",
  "department": "IT/Sales/HR/etc",
  "challenges": [],
  "kpis": [],
  "priorities": [],
  "trends": [],
  "outreachAngles": [],
  "commonObjections": [],
  "discoveryQuestions": [],
  "decisionMakingPower": "Decision maker/Influencer/End user",
  "reportingTo": "Typical manager",
  "teamSize": "Team size"
}`
            }],
            temperature: 0.4,
            max_tokens: 1500
        });

        const elapsed = Date.now() - startTime;
        console.log(`[Role Intelligence] Completed in ${elapsed}ms`);

        const rawText = response.content[0].text;
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const intelligence = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

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
