/**
 * AI-Powered Persona Generator
 * Analyzes LinkedIn data to create comprehensive prospect personas
 */

// DISC Personality Types
export type DISCType = 'D' | 'I' | 'S' | 'C' | 'DI' | 'DC' | 'IS' | 'SC' | 'ID' | 'SI' | 'CS' | 'CD'

export interface CompanyInfo {
    name: string
    industry?: string
    size?: string
    linkedinUrl?: string
    description?: string
    website?: string
}

export interface LinkedInPost {
    text: string
    date?: string
    engagement?: {
        likes: number
        comments: number
        shares?: number
    }
    topics?: string[]
}

export interface PersonaProfile {
    discProfile: DISCType
    discDescription: string
    communicationStyle: string
    keyInterests: string[]
    focusAreas: string[]
    talkingPoints: string[]
    approachRecommendation: string
    painPoints?: string[]
    motivators?: string[]
}

export interface EnhancedLinkedInData {
    // Basic Profile
    firstName: string
    lastName: string
    headline?: string
    summary?: string
    location?: string
    profileUrl?: string

    // Current Role
    company?: string
    jobTitle?: string

    // Company Info (enriched)
    companyInfo?: CompanyInfo

    // Experience & Education
    experience?: Array<{
        title: string
        company: string
        duration?: string
        description?: string
    }>
    education?: Array<{
        school: string
        degree?: string
        field?: string
    }>
    skills?: string[]

    // Posts & Activity
    recentPosts?: LinkedInPost[]

    // AI-Generated Persona
    persona?: PersonaProfile

    // Metadata
    enrichedAt?: string
    enrichmentVersion?: string
}

// DISC Profile descriptions and approach recommendations
const DISC_PROFILES: Record<string, { description: string; approach: string; traits: string[] }> = {
    D: {
        description: 'Dominant - Results-oriented, direct, decisive, competitive',
        approach: 'Be brief and direct. Focus on bottom-line results and ROI. Let them feel in control. Avoid too much small talk.',
        traits: ['results', 'direct', 'decisive', 'competitive', 'driven', 'goal-oriented', 'assertive']
    },
    I: {
        description: 'Influential - Enthusiastic, optimistic, collaborative, social',
        approach: 'Build rapport first. Be enthusiastic and personable. Share success stories. Allow time for discussion.',
        traits: ['enthusiastic', 'social', 'optimistic', 'collaborative', 'creative', 'inspiring', 'team']
    },
    S: {
        description: 'Steady - Patient, reliable, team-oriented, supportive',
        approach: 'Take time to build trust. Provide stability and reassurance. Show how you support their team. Avoid rushing.',
        traits: ['reliable', 'patient', 'supportive', 'team player', 'consistent', 'loyal', 'helpful']
    },
    C: {
        description: 'Conscientious - Analytical, precise, systematic, quality-focused',
        approach: 'Come prepared with data and details. Be accurate and thorough. Allow time for analysis. Avoid pressure tactics.',
        traits: ['analytical', 'detail-oriented', 'precise', 'systematic', 'quality', 'accurate', 'thorough']
    },
    DI: {
        description: 'Dominant-Influential - Results-driven and people-oriented',
        approach: 'Be direct but personable. Focus on results while building rapport. Share quick wins and success stories.',
        traits: ['results', 'social', 'competitive', 'inspiring', 'action-oriented']
    },
    DC: {
        description: 'Dominant-Conscientious - Results-focused with attention to detail',
        approach: 'Be direct and data-driven. Provide facts that support ROI. Be efficient with their time.',
        traits: ['results', 'analytical', 'efficient', 'strategic', 'precise']
    },
    IS: {
        description: 'Influential-Steady - People-oriented and supportive',
        approach: 'Build strong rapport. Focus on team benefits and relationships. Be warm and patient.',
        traits: ['social', 'supportive', 'collaborative', 'patient', 'team-focused']
    },
    SC: {
        description: 'Steady-Conscientious - Reliable and detail-oriented',
        approach: 'Be patient and thorough. Provide clear processes and documentation. Build trust over time.',
        traits: ['reliable', 'analytical', 'systematic', 'supportive', 'quality-focused']
    }
}

/**
 * Generate a comprehensive persona using AI analysis
 */
export async function generatePersona(
    profileData: Partial<EnhancedLinkedInData>,
    openaiApiKey?: string
): Promise<PersonaProfile> {
    const apiKey = openaiApiKey || process.env.OPENAI_API_KEY

    if (!apiKey) {
        console.log('[Persona] No OpenAI API key, using rule-based analysis')
        return generateRuleBasedPersona(profileData)
    }

    try {
        const prompt = buildPersonaPrompt(profileData)

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert sales psychologist who analyzes LinkedIn profiles to create prospect personas for B2B sales calls. 
            
You assess DISC personality types by analyzing communication style, content themes, and professional focus. Be concise and actionable.

Return JSON only, no markdown.`
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1000,
            }),
        })

        if (!response.ok) {
            console.error('[Persona] OpenAI API error:', response.status)
            return generateRuleBasedPersona(profileData)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || ''

        // Parse JSON response
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const persona = JSON.parse(jsonMatch[0]) as PersonaProfile
                console.log('[Persona] AI analysis complete:', persona.discProfile)
                return persona
            }
        } catch (parseError) {
            console.error('[Persona] JSON parse error:', parseError)
        }

        return generateRuleBasedPersona(profileData)
    } catch (error) {
        console.error('[Persona] AI generation error:', error)
        return generateRuleBasedPersona(profileData)
    }
}

/**
 * Build prompt for AI persona analysis
 */
function buildPersonaPrompt(profile: Partial<EnhancedLinkedInData>): string {
    // Check if we have rich data or minimal data
    const hasRichData = !!(profile.summary || profile.skills?.length || profile.recentPosts?.length || profile.experience?.length);

    let context = '';

    if (hasRichData) {
        context = `Analyze this LinkedIn profile and generate a sales persona:\n\n`;
    } else {
        // Minimal data fallback - be explicit about what we DON'T have
        context = `Generate a sales persona for a B2B outreach call to this prospect. 
        
IMPORTANT: We only have basic information about this person (name, title, company). 
Do NOT mention "LinkedIn" as a platform or topic in your analysis.
Focus entirely on their ROLE, COMPANY, and INDUSTRY.
Generate realistic, role-appropriate content based on what someone in their position typically cares about.

Analyze this prospect:\n\n`;
    }

    if (profile.firstName || profile.lastName) {
        context += `Name: ${profile.firstName} ${profile.lastName}\n`;
    }
    if (profile.headline) {
        context += `Headline: ${profile.headline}\n`;
    }
    if (profile.jobTitle && profile.company) {
        context += `Role: ${profile.jobTitle} at ${profile.company}\n`;
    } else if (profile.jobTitle) {
        context += `Role: ${profile.jobTitle}\n`;
    } else if (profile.company) {
        context += `Company: ${profile.company}\n`;
    }
    if (profile.summary) {
        context += `Summary: ${profile.summary}\n`;
    }
    if (profile.skills?.length) {
        context += `Skills: ${profile.skills.slice(0, 10).join(', ')}\n`;
    }
    if (profile.experience?.length) {
        context += `Experience: ${profile.experience.slice(0, 3).map(e => `${e.title} at ${e.company}`).join('; ')}\n`;
    }
    if (profile.recentPosts?.length) {
        context += `\nRecent Posts:\n`;
        profile.recentPosts.slice(0, 3).forEach(post => {
            context += `- ${post.text.substring(0, 200)}...\n`;
        });
    }

    // Add industry context for minimal data scenarios
    if (!hasRichData && profile.company) {
        context += `\nNote: Base your analysis on what a ${profile.jobTitle || 'professional'} at a company like ${profile.company} would typically focus on.\n`;
    }

    context += `
Return a JSON object with these fields:
{
  "discProfile": "D|I|S|C|DI|DC|IS|SC" (primary and secondary type),
  "discDescription": "Brief description of their personality style based on their role",
  "communicationStyle": "How they likely prefer to communicate",
  "keyInterests": ["3-5 key professional interests relevant to their role"],
  "focusAreas": ["3-5 areas they likely focus on in their current role"],
  "talkingPoints": ["3-5 personalized conversation starters about their industry/role"],
  "approachRecommendation": "How to approach this person in a B2B sales call",
  "painPoints": ["2-3 likely pain points based on their role and company type"],
  "motivators": ["2-3 things that likely motivate someone in their position"]
}

CRITICAL: 
- Make talking points about THEIR INDUSTRY and ROLE, not about any social media platform
- Focus on business challenges relevant to their job title
- Pain points should relate to their actual work, not networking or content creation`

    return context;
}


/**
 * Generate persona using rule-based analysis (fallback)
 */
function generateRuleBasedPersona(profile: Partial<EnhancedLinkedInData>): PersonaProfile {
    // Analyze available text content
    const textContent = [
        profile.headline || '',
        profile.summary || '',
        profile.jobTitle || '',
        ...(profile.skills || []),
        ...(profile.recentPosts?.map(p => p.text) || [])
    ].join(' ').toLowerCase()

    // Score each DISC type based on keywords
    const scores = { D: 0, I: 0, S: 0, C: 0 }

    Object.entries(DISC_PROFILES).forEach(([type, info]) => {
        if (type.length === 1) { // Only score primary types
            info.traits.forEach(trait => {
                if (textContent.includes(trait)) {
                    scores[type as keyof typeof scores] += 1
                }
            })
        }
    })

    // Determine primary and secondary types
    const sortedTypes = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])

    const primaryType = sortedTypes[0][0] as 'D' | 'I' | 'S' | 'C'
    const secondaryType = sortedTypes[1][1] > 0 ? sortedTypes[1][0] : null

    const discProfile = secondaryType && scores[secondaryType as keyof typeof scores] > 0
        ? `${primaryType}${secondaryType}` as DISCType
        : primaryType as DISCType

    const profileInfo = DISC_PROFILES[discProfile] || DISC_PROFILES[primaryType]

    // Extract interests from skills and headline
    const keyInterests = profile.skills?.slice(0, 5) || []

    // Determine focus areas from job title
    const focusAreas: string[] = []
    if (profile.jobTitle) {
        if (profile.jobTitle.toLowerCase().includes('sales')) focusAreas.push('Revenue Growth')
        if (profile.jobTitle.toLowerCase().includes('marketing')) focusAreas.push('Brand & Demand')
        if (profile.jobTitle.toLowerCase().includes('product')) focusAreas.push('Product Strategy')
        if (profile.jobTitle.toLowerCase().includes('engineering')) focusAreas.push('Technical Excellence')
        if (profile.jobTitle.toLowerCase().includes('ceo') || profile.jobTitle.toLowerCase().includes('founder')) {
            focusAreas.push('Business Growth', 'Strategy')
        }
    }
    if (focusAreas.length === 0) focusAreas.push('Professional Development')

    // Generate talking points
    const talkingPoints: string[] = []
    if (profile.company) {
        talkingPoints.push(`Ask about their experience at ${profile.company}`)
    }
    if (profile.headline) {
        talkingPoints.push(`Reference their focus on "${profile.headline.substring(0, 50)}"`)
    }
    if (profile.skills?.length) {
        talkingPoints.push(`Discuss their expertise in ${profile.skills[0]}`)
    }

    return {
        discProfile,
        discDescription: profileInfo.description,
        communicationStyle: getCommStyleFromDISC(primaryType),
        keyInterests: keyInterests.length > 0 ? keyInterests : ['Professional growth'],
        focusAreas,
        talkingPoints: talkingPoints.length > 0 ? talkingPoints : ['Ask about their role and challenges'],
        approachRecommendation: profileInfo.approach,
        painPoints: getPainPointsFromRole(profile.jobTitle),
        motivators: getMotivatorsFromDISC(primaryType)
    }
}

function getCommStyleFromDISC(type: string): string {
    switch (type) {
        case 'D': return 'Direct, to-the-point, values efficiency'
        case 'I': return 'Warm, enthusiastic, enjoys conversation'
        case 'S': return 'Patient, thoughtful, prefers steady pace'
        case 'C': return 'Precise, detail-oriented, fact-based'
        default: return 'Professional and adaptable'
    }
}

function getPainPointsFromRole(jobTitle?: string): string[] {
    const title = (jobTitle || '').toLowerCase()
    if (title.includes('ceo') || title.includes('founder')) {
        return ['Scaling operations', 'Finding the right talent', 'Sustainable growth']
    }
    if (title.includes('sales') || title.includes('revenue')) {
        return ['Meeting quotas', 'Lead quality', 'Sales efficiency']
    }
    if (title.includes('marketing')) {
        return ['Proving ROI', 'Lead generation', 'Brand awareness']
    }
    if (title.includes('product')) {
        return ['Prioritization', 'Customer feedback', 'Time to market']
    }
    if (title.includes('engineering') || title.includes('tech')) {
        return ['Technical debt', 'Scaling systems', 'Team productivity']
    }
    return ['Efficiency', 'Growth', 'Team alignment']
}

function getMotivatorsFromDISC(type: string): string[] {
    switch (type) {
        case 'D': return ['Winning', 'Results', 'Control']
        case 'I': return ['Recognition', 'Collaboration', 'Innovation']
        case 'S': return ['Stability', 'Team success', 'Helping others']
        case 'C': return ['Accuracy', 'Quality', 'Expertise']
        default: return ['Success', 'Growth']
    }
}
