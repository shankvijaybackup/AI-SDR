/**
 * Lead Research Service
 * 
 * Automatically researches leads before calls by:
 * 1. Searching knowledge base for relevant content
 * 2. Researching the prospect's company (what they do, pain points)
 * 3. Researching the lead's ROLE (what challenges they face)
 * 4. Finding industry-specific talking points
 * 5. Identifying relevant case studies
 * 6. Building comprehensive lead context with sales approach
 */

import { researchProspectCompany, formatProspectResearch } from './companyResearch.js';
import { researchRoleChallenges, formatRoleIntelligence } from './roleIntelligence.js';

/**
 * Research a lead and build context from knowledge base + prospect company + role intelligence
 */
export async function researchLead(lead, sellerCompanyDescription = '', sellerThemes = [], prisma = null) {
    console.log(`[Lead Research] Starting research for ${lead.name} at ${lead.company}`)

    const context = {
        lead: {
            name: lead.name,
            company: lead.company,
            industry: lead.industry || 'Unknown',
            role: lead.role || lead.jobTitle || 'Unknown',
            email: lead.email
        },
        relevantKnowledge: [],
        prospectCompanyResearch: null,
        prospectContext: '',
        roleIntelligence: null,  // NEW: Role-specific challenges and outreach angles
        roleContext: '',          // NEW: Formatted role intelligence for AI
        themeMatches: [],         // NEW: Matched seller themes to lead pain points
        talkingPoints: [],
        caseStudies: [],
        objectionResponses: [],
        personalizedScript: null
    }

    try {
        // 1. Research knowledge base, prospect company, AND role challenges in PARALLEL
        const [knowledgeMatches, prospectResearch, roleIntel] = await Promise.all([
            searchKnowledgeBase(lead, prisma),
            // Research the prospect's company if we have their company name
            lead.company && lead.company !== 'Unknown'
                ? researchProspectCompany(lead.company, sellerCompanyDescription, lead.role || lead.jobTitle)
                : Promise.resolve(null),
            // Research role-specific challenges
            (lead.role || lead.jobTitle)
                ? researchRoleChallenges(lead.role || lead.jobTitle, lead.industry)
                : Promise.resolve(null)
        ]);

        context.relevantKnowledge = knowledgeMatches

        // Store prospect company research
        if (prospectResearch) {
            context.prospectCompanyResearch = prospectResearch;
            context.prospectContext = formatProspectResearch(prospectResearch);
            console.log(`[Lead Research] Researched prospect company: ${prospectResearch.companyName} - ${prospectResearch.industry}`);
        }

        // Store role intelligence
        if (roleIntel) {
            context.roleIntelligence = roleIntel;
            context.roleContext = formatRoleIntelligence(roleIntel);
            console.log(`[Lead Research] Role intelligence: ${roleIntel.challenges?.length || 0} challenges, ${roleIntel.kpis?.length || 0} KPIs`);
        }

        // 2. Match seller themes to lead pain points
        if (sellerThemes.length > 0 && (prospectResearch || roleIntel)) {
            context.themeMatches = matchThemesToPainPoints(
                sellerThemes,
                [
                    ...(prospectResearch?.potentialPainPoints || []),
                    ...(roleIntel?.challenges || [])
                ]
            );
            console.log(`[Lead Research] Theme matches: ${context.themeMatches.length}`);
        }

        // 3. Extract talking points from knowledge + prospect research + role intel
        context.talkingPoints = extractTalkingPoints(knowledgeMatches, lead, prospectResearch, roleIntel)

        // 4. Find relevant case studies
        context.caseStudies = findCaseStudies(knowledgeMatches, lead.industry)

        // 5. Prepare objection responses (enhanced with prospect research + role objections)
        context.objectionResponses = findObjectionHandling(knowledgeMatches, prospectResearch, roleIntel)

        // 6. Generate personalized opening script
        context.personalizedScript = await generatePersonalizedScript(lead, context)

        console.log(`[Lead Research] Found ${context.relevantKnowledge.length} relevant knowledge sources`)
        console.log(`[Lead Research] Generated ${context.talkingPoints.length} talking points`)

        // 7. Inject Strategic Intelligence (LinkedIn Enhanced)
        if (lead.linkedinData?.persona) {
            console.log('[Lead Research] Injecting Strategic Intelligence from LinkedIn Persona');
            context.strategicIntelligence = lead.linkedinData.persona;
        }

        return context
    } catch (error) {
        console.error('[Lead Research] Error:', error)
        // Return basic context even if research fails
        return context
    }
}

/**
 * Search knowledge base for content relevant to this lead
 */
async function searchKnowledgeBase(lead, prisma) {
    // Fallback URL only if prisma not used (legacy support)
    const backendUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:4000'
    const matches = []

    try {
        if (prisma) {
            // Use direct DB access - FAST & ROBUST
            const userId = lead.userId;

            // Construct where clause: User's files OR Shared files
            const where = {
                isActive: true,
                OR: [
                    { isShared: true },
                    ...(userId ? [{ userId: userId }] : [])
                ]
            };

            const sources = await prisma.knowledgeSource.findMany({
                where,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    summary: true,
                    category: true,
                    tags: true,
                    type: true
                }
            });

            matches.push(...sources);
        } else {
            // Legacy HTTP fetch (Fragile on Cloud)
            const searchTerms = [
                lead.company,
                lead.industry,
                lead.role
            ].filter(Boolean)

            console.warn('[Knowledge Search] Warning: Using HTTP fetch instead of direct DB access. Pass prisma instance for better performance.');

            for (const term of searchTerms) {
                try {
                    const response = await fetch(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/knowledge?search=${encodeURIComponent(term)}`)
                    if (response.ok) {
                        const data = await response.json()
                        matches.push(...data.knowledgeSources)
                    }
                } catch (fetchErr) {
                    console.error('[Knowledge Search] HTTP Fetch failed:', fetchErr.message);
                }
            }
        }

        // Deduplicate and rank by relevance
        const uniqueMatches = deduplicateKnowledge(matches)
        return rankByRelevance(uniqueMatches, lead)
    } catch (error) {
        console.error('[Knowledge Search] Error:', error)
        return []
    }
}

/**
 * Remove duplicate knowledge sources
 */
function deduplicateKnowledge(sources) {
    const seen = new Set()
    return sources.filter(source => {
        if (!source || !source.id) return false
        if (seen.has(source.id)) return false
        seen.add(source.id)
        return true
    })
}

/**
 * Rank knowledge sources by relevance to lead
 */
function rankByRelevance(sources, lead) {
    return sources
        .map(source => {
            let score = 0
            const text = `${source.title} ${source.description || ''} ${source.summary || ''}`.toLowerCase()

            // Score based on matches
            if (lead.company && text.includes(lead.company.toLowerCase())) score += 10
            if (lead.industry && text.includes(lead.industry.toLowerCase())) score += 8
            if (lead.role && text.includes(lead.role.toLowerCase())) score += 5

            // Keyword matches from lead fields
            if (lead.role) {
                const roleParts = lead.role.toLowerCase().split(' ');
                roleParts.forEach(part => {
                    if (part.length > 3 && text.includes(part)) score += 2;
                });
            }

            // Boost certain categories
            if (source.category === 'customer_story') score += 7
            if (source.category === 'objection_handling') score += 6
            if (source.category === 'sales') score += 5

            return { ...source, relevanceScore: score }
        })
        .filter(s => s.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10) // Top 10 most relevant
}

/**
 * Extract key talking points from knowledge sources + role intelligence
 */
function extractTalkingPoints(knowledgeSources, lead, prospectResearch, roleIntel) {
    const points = []

    // Add role-specific discovery questions first (most valuable)
    if (roleIntel?.discoveryQuestions) {
        points.push(...roleIntel.discoveryQuestions.slice(0, 2))
    }

    // Add prospect-specific talking points
    if (prospectResearch?.talkingPoints) {
        points.push(...prospectResearch.talkingPoints.slice(0, 2))
    }

    for (const source of knowledgeSources.slice(0, 5)) { // Top 5 sources
        // Extract from summary if available
        if (source.summary) {
            const sentences = source.summary.match(/[^.!?]+[.!?]+/g) || []
            points.push(...sentences.slice(0, 2).map(s => s.trim()))
        }

        // Extract from description
        if (source.description) {
            points.push(source.description.trim())
        }
    }

    // Deduplicate and limit
    return [...new Set(points)].slice(0, 10)
}

/**
 * Find case studies relevant to lead's industry
 */
function findCaseStudies(knowledgeSources, industry) {
    return knowledgeSources
        .filter(s => s.category === 'customer_story' || s.type === 'case_study')
        .filter(s => {
            if (!industry) return true
            const text = `${s.title} ${s.description || ''}`.toLowerCase()
            return text.includes(industry.toLowerCase())
        })
        .slice(0, 3)
        .map(s => ({
            title: s.title,
            summary: s.summary || s.description,
            industry: s.tags?.find(t => t.includes('industry')) || industry
        }))
}

/**
 * Find objection handling responses - includes role-specific objections
 */
function findObjectionHandling(knowledgeSources, prospectResearch, roleIntel) {
    const objections = []

    // From knowledge base
    const kbObjections = knowledgeSources
        .filter(s => s.category === 'objection_handling')
        .slice(0, 3)
        .map(s => ({
            objection: s.title,
            response: s.summary || s.description,
            source: 'knowledge_base'
        }))
    objections.push(...kbObjections)

    // From role intelligence (common objections for this role)
    if (roleIntel?.commonObjections) {
        const roleObjections = roleIntel.commonObjections.slice(0, 3).map(obj => ({
            objection: obj,
            response: null, // No pre-built response, AI will handle
            source: 'role_intelligence'
        }))
        objections.push(...roleObjections)
    }

    return objections.slice(0, 6)
}

/**
 * Match seller themes to lead pain points
 * Returns array of theme matches with relevance scores
 */
function matchThemesToPainPoints(sellerThemes, leadPainPoints) {
    if (!sellerThemes?.length || !leadPainPoints?.length) {
        return []
    }

    const matches = []

    // Normalize themes and pain points
    const themes = sellerThemes.map(t => ({
        original: t,
        normalized: t.toLowerCase()
    }))

    // Common stop words to ignore in matching
    const stopWords = new Set(['the', 'and', 'or', 'to', 'for', 'with', 'a', 'an', 'in', 'of', 'on', 'at', 'by'])

    for (const theme of themes) {
        for (const painPoint of leadPainPoints) {
            const painLower = painPoint.toLowerCase()

            // 1. Direct inclusion check (High confidence)
            if (painLower.includes(theme.normalized) || theme.normalized.includes(painLower)) {
                matches.push({
                    theme: theme.original,
                    painPoint: painPoint,
                    relevance: `Directly addresses "${theme.original}"`,
                    score: 10
                })
                continue
            }

            // 2. Keyword overlap check (Medium confidence)
            const themeWords = theme.normalized.split(/[\s-]+/).filter(w => w.length > 3 && !stopWords.has(w))
            const painWords = painLower.split(/[\s-]+/).filter(w => w.length > 3 && !stopWords.has(w))

            const matchedKeywords = themeWords.filter(tw =>
                painWords.some(pw => pw.includes(tw) || tw.includes(pw))
            )

            if (matchedKeywords.length > 0) {
                matches.push({
                    theme: theme.original,
                    painPoint: painPoint,
                    relevance: `Related to ${matchedKeywords.join(', ')}`,
                    score: matchedKeywords.length * 2
                })
            }
        }
    }

    // Sort by score and deduplicate by theme
    const seen = new Set()
    return matches
        .sort((a, b) => b.score - a.score)
        .filter(m => {
            const key = `${m.theme}-${m.painPoint}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        .slice(0, 5)
}

/**
 * Generate personalized opening script based on lead context
 */
async function generatePersonalizedScript(lead, context) {
    // Build a contextual opening that references relevant knowledge
    const parts = []

    // Standard greeting
    parts.push(`Hi ${lead.name}, this is {{repName}} from {{companyName}}.`)

    // 1. Try to use a Theme Match (Highest Priority)
    if (context.themeMatches && context.themeMatches.length > 0) {
        const bestMatch = context.themeMatches[0]
        parts.push(`I'm reaching out because I see a lot of ${context.lead.role}s struggling with ${bestMatch.painPoint.toLowerCase()}, and our ${bestMatch.theme.toLowerCase()} approach specifically solves this.`)
    }
    // 2. Use Role Intelligence
    else if (context.roleIntelligence?.challenges?.length > 0) {
        // Use a random challenge to keep it fresh
        const challenge = context.roleIntelligence.challenges[0]
        parts.push(`I'm reaching out because many ${context.lead.role}s are focused on ${challenge.toLowerCase()} right now.`)
    }
    // 3. Use Case Study
    else if (context.caseStudies.length > 0) {
        const caseStudy = context.caseStudies[0]
        parts.push(`I wanted to reach out because we recently helped ${caseStudy.industry} companies like yours ${caseStudy.summary?.substring(0, 80) || 'achieve great results'}.`)
    }
    // 4. Use Talking Points
    else if (context.talkingPoints.length > 0) {
        const point = context.talkingPoints[0]
        parts.push(`I wanted to share how we're helping ${lead.industry || 'companies like yours'} ${point.substring(0, 80)}.`)
    } else {
        parts.push(`How are you doing today?`)
    }

    // Add soft CTA
    parts.push(`Do you have a quick minute to chat?`)

    return parts.join(' ')
}

/**
 * Build enhanced system prompt with lead context
 */
export function buildContextualSystemPrompt({
    basePersona,
    leadContext,
    relevantKnowledge,
    openingScript,
    objectionResponses
}) {
    // Extract key context items
    const {
        lead,
        roleContext,
        roleIntelligence,
        themeMatches,
        prospectCompanyResearch,
        prospectContext,
        strategicIntelligence // NEW: Strategic Intelligence from LinkedIn
    } = leadContext

    const prompt = `
You are an AI sales representative with deep knowledge about your company and the prospect.

=== PROSPECT INTELLIGENCE ===
NAME: ${lead.name}
ROLE: ${lead.role}
COMPANY: ${lead.company}
INDUSTRY: ${lead.industry}
${lead.email ? `EMAIL: ${lead.email}` : ''}

${strategicIntelligence ? `
=== EXECUTIVE BRIEF (STRATEGIC INTELLIGENCE) ===
PERSONALITY: ${strategicIntelligence.discProfile} - ${strategicIntelligence.discDescription}
COMMUNICATION STYLE: ${strategicIntelligence.communicationStyle}

> SNAPSHOT: ${strategicIntelligence.executiveSnapshot?.roleAndFocus || 'N/A'}
> CORE STRENGTHS: ${strategicIntelligence.executiveSnapshot?.coreStrengths?.join(', ') || 'N/A'}
> LEADERSHIP READ: ${strategicIntelligence.executiveSnapshot?.personaRead || 'N/A'}

=== STRATEGIC PREP ===
HOOK: ${strategicIntelligence.strategicPrep?.connectionAngle || 'N/A'}
COMMON GROUND: ${strategicIntelligence.strategicPrep?.commonGround || 'N/A'}
SMART QUESTIONS:
${strategicIntelligence.strategicPrep?.smartQuestions?.map(q => `- ${q}`).join('\n') || 'N/A'}

=== INTERNAL COACHING (HOW TO WIN) ===
DO: ${strategicIntelligence.internalCoaching?.howToWin?.join(' | ') || 'N/A'}
DON'T: ${strategicIntelligence.internalCoaching?.pitfallsAvoid?.join(' | ') || 'N/A'}
` : ''}

${prospectContext ? `
=== COMPANY RESEARCH ===
${prospectContext}
` : ''}

${roleContext ? `
=== ROLE INSIGHTS (What matters to a ${lead.role}) ===
${roleContext}
` : ''}

${themeMatches && themeMatches.length > 0 ? `
=== KEY VALUE MATCHES (Connecting our solution to their needs) ===
${themeMatches.map(m => `- They likely struggle with: "${m.painPoint}"
  -> Our Solution Connection: "${m.theme}" (${m.relevance})`).join('\n')}
` : ''}

=== RELEVANT KNOWLEDGE BASE ===
${relevantKnowledge.slice(0, 5).map((k, i) => `
${i + 1}. ${k.title}
   ${k.summary || k.description || ''}
`).join('\n')}

=== TALKING POINTS ===
${leadContext.talkingPoints.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join('\n')}

${leadContext.caseStudies.length > 0 ? `
=== RELEVANT CASE STUDIES ===
${leadContext.caseStudies.map((cs, i) => `${i + 1}. ${cs.title}: ${cs.summary}`).join('\n')}
` : ''}

=== OBJECTION HANDLING ===
${objectionResponses.map((obj, i) => `
Q: ${obj.objection}
A: ${obj.response || "Address this using the role insights above."}
`).join('\n')}

=== STARTING SCRIPT ===
${openingScript}

=== GUIDELINES ===
1. Be natural and conversational - you're a knowledgeable sales rep, not a robot
2. USE THE EXECUTIVE BRIEF: Adjust your tone to the "Communication Style" and use the "Smart Questions" to drive the conversation.
3. If specific "Hook" or "Common Ground" is provided in the Executive Brief, try to weave it in early.
4. USE THE INTELLIGENCE: Address the specific challenges found in the "ROLE INSIGHTS" and "KEY VALUE MATCHES" sections.
5. If they mention one of the challenges in "KEY VALUE MATCHES", pivot immediately to how our "${themeMatches?.[0]?.theme || 'solution'}" helps.
6. Mention case studies if they fit the conversation naturally
7. Listen actively and respond to the prospect's specific concerns
8. Keep responses under 50 words for natural pacing
9. Guide towards booking a meeting, but don't be pushy
10. If they show interest, verify their email: ${lead.email || 'ask for it'}
11. Adapt your approach based on their industry (${lead.industry})
12. Be ready to handle objections using the responses above

Remember: You have deep knowledge about this prospect and relevant solutions. Use it naturally!
`

    return prompt
}
