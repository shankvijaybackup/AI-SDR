/**
 * Lead Research Service
 * 
 * Automatically researches leads before calls by:
 * 1. Searching knowledge base for relevant content
 * 2. Finding industry-specific talking points
 * 3. Identifying relevant case studies
 * 4. Building comprehensive lead context
 */

/**
 * Research a lead and build context from knowledge base
 */
export async function researchLead(lead) {
    console.log(`[Lead Research] Starting research for ${lead.name} at ${lead.company}`)

    const context = {
        lead: {
            name: lead.name,
            company: lead.company,
            industry: lead.industry || 'Unknown',
            role: lead.role || 'Unknown',
            email: lead.email
        },
        relevantKnowledge: [],
        talkingPoints: [],
        caseStudies: [],
        objectionResponses: [],
        personalizedScript: null
    }

    try {
        // 1. Search knowledge base for relevant content
        const knowledgeMatches = await searchKnowledgeBase(lead)
        context.relevantKnowledge = knowledgeMatches

        // 2. Extract talking points from knowledge
        context.talkingPoints = extractTalkingPoints(knowledgeMatches, lead)

        // 3. Find relevant case studies
        context.caseStudies = findCaseStudies(knowledgeMatches, lead.industry)

        // 4. Prepare objection responses
        context.objectionResponses = findObjectionHandling(knowledgeMatches)

        // 5. Generate personalized opening script
        context.personalizedScript = await generatePersonalizedScript(lead, context)

        console.log(`[Lead Research] Found ${context.relevantKnowledge.length} relevant knowledge sources`)
        console.log(`[Lead Research] Generated ${context.talkingPoints.length} talking points`)

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
async function searchKnowledgeBase(lead) {
    // This will integrate with the existing knowledge base API
    const backendUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:4000'

    try {
        // Search by company name, industry, and role
        const searchTerms = [
            lead.company,
            lead.industry,
            lead.role,
            // Add common variations
            lead.industry ? `${lead.industry} industry` : null,
            lead.role ? `${lead.role} challenges` : null
        ].filter(Boolean)

        const matches = []

        // Call frontend knowledge API to search
        // Note: This assumes knowledge base has embeddings and search capability
        for (const term of searchTerms) {
            const response = await fetch(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/knowledge?search=${encodeURIComponent(term)}`)
            if (response.ok) {
                const data = await response.json()
                matches.push(...data.knowledgeSources)
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
 * Extract key talking points from knowledge sources
 */
function extractTalkingPoints(knowledgeSources, lead) {
    const points = []

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
    return [...new Set(points)].slice(0, 8)
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
 * Find objection handling responses
 */
function findObjectionHandling(knowledgeSources) {
    return knowledgeSources
        .filter(s => s.category === 'objection_handling')
        .slice(0, 5)
        .map(s => ({
            objection: s.title,
            response: s.summary || s.description
        }))
}

/**
 * Generate personalized opening script based on lead context
 */
async function generatePersonalizedScript(lead, context) {
    // Build a contextual opening that references relevant knowledge
    const parts = []

    // Standard greeting
    parts.push(`Hi ${lead.name}, this is {{repName}} from {{companyName}}.`)

    // Add context-specific hook
    if (context.caseStudies.length > 0) {
        const caseStudy = context.caseStudies[0]
        parts.push(`I wanted to reach out because we recently helped ${caseStudy.industry} companies like yours ${caseStudy.summary?.substring(0, 80) || 'achieve great results'}.`)
    } else if (context.talkingPoints.length > 0) {
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
    const prompt = `
You are an AI sales representative with deep knowledge about your company and the prospect.

PROSPECT CONTEXT:
- Name: ${leadContext.lead.name}
- Company: ${leadContext.lead.company}
- Industry: ${leadContext.lead.industry}
- Role: ${leadContext.lead.role}
- Email: ${leadContext.lead.email || 'Unknown'}

RELEVANT KNOWLEDGE:
${relevantKnowledge.slice(0, 5).map((k, i) => `
${i + 1}. ${k.title}
   ${k.summary || k.description || ''}
`).join('\n')}

KEY TALKING POINTS:
${leadContext.talkingPoints.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join('\n')}

${leadContext.caseStudies.length > 0 ? `
RELEVANT CASE STUDIES:
${leadContext.caseStudies.map((cs, i) => `${i + 1}. ${cs.title}: ${cs.summary}`).join('\n')}
` : ''}

${objectionResponses.length > 0 ? `
OBJECTION HANDLING:
${objectionResponses.map((obj, i) => `
Q: ${obj.objection}
A: ${obj.response}
`).join('\n')}
` : ''}

OPENING SCRIPT:
${openingScript}

GUIDELINES:
1. Be natural and conversational - you're a knowledgeable sales rep, not a robot
2. Reference the relevant knowledge above when appropriate
3. Mention case studies if they fit the conversation naturally
4. Listen actively and respond to the prospect's specific concerns
5. Keep responses under 50 words for natural pacing
6. Guide towards booking a meeting, but don't be pushy
7. If they show interest, verify their email: ${leadContext.lead.email || 'ask for it'}
8. Use their name (${leadContext.lead.name}) occasionally but not excessively
9. Adapt your approach based on their industry (${leadContext.lead.industry})
10. Be ready to handle objections using the responses above

Remember: You have deep knowledge about this prospect and relevant solutions. Use it naturally!
`

    return prompt
}
