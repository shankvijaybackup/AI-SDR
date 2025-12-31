
// LinkedIn profile enrichment service using Hybrid RapidAPI Approach
// Primary: Real-Time LinkedIn Scraper (Structured JSON)
// Secondary (Fallback): ScrapeNinja (HTML Parsing)

import { prisma } from './prisma'
import { generatePersona, EnhancedLinkedInData, LinkedInPost, CompanyInfo } from './persona-generator'

interface LinkedInProfile {
  firstName: string
  lastName: string
  headline?: string
  summary?: string
  location?: string
  company?: string
  jobTitle?: string
  experience?: Array<{
    title: string
    company: string
    duration?: string
    description?: string
    location?: string
  }>
  education?: Array<{
    school: string
    degree?: string
    field?: string
  }>
  skills?: string[]
  profileUrl?: string
  source?: 'realtime' | 'scrapeninja' | 'basic'
}

/**
 * Fetch LinkedIn profile data using a hybrid strategy
 */
export async function fetchLinkedInProfile(
  linkedinUrl: string,
  sessionCookie: string // Unused, kept for interface compatibility
): Promise<LinkedInProfile | null> {
  const username = extractLinkedInUsername(linkedinUrl)
  if (!username) {
    console.error('[LinkedIn] Invalid LinkedIn URL:', linkedinUrl)
    return null
  }

  // 1. Try Primary API (Real-Time)
  console.log(`[LinkedIn] Fetching profile for ${username}... Strategy: Hybrid`)
  const primaryProfile = await fetchRealTimeApiProfile(username)
  if (primaryProfile) {
    console.log('[LinkedIn] Success with Primary API (Real-Time)')
    return primaryProfile
  }

  // 2. Fallback to Secondary API (ScrapeNinja)
  console.log('[LinkedIn] Primary API failed/empty. Trying Secondary (ScrapeNinja)...')
  const fullUrl = linkedinUrl.startsWith('http') ? linkedinUrl : `https://www.linkedin.com/in/${username}`
  return await fetchScrapeNinjaProfile(fullUrl)
}

/**
 * Strategy A: Real-Time LinkedIn Scraper (Structured Data)
 */
async function fetchRealTimeApiProfile(username: string): Promise<LinkedInProfile | null> {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!rapidApiKey) return null

  try {
    const host = 'linkedin-scraper-api-real-time-fast-affordable.p.rapidapi.com'
    const url = `https://${host}/profile/detail?username=${username}`

    console.log('[LinkedIn] Calling Real-Time API...')
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': host,
        'x-rapidapi-key': rapidApiKey
      }
    })

    if (!response.ok) {
      console.warn(`[LinkedIn] Real-Time API Error: ${response.status} ${response.statusText}`)
      return null
    }

    const json = await response.json()
    const data = json.data

    // Validate essential data exists
    if (!data || !data.basic_info) {
      console.warn('[LinkedIn] Real-Time API returned invalid structure')
      return null
    }

    const basic = data.basic_info

    // Map Experience
    const experience = (data.experience || []).map((exp: any) => ({
      title: exp.title || '',
      company: exp.company || '',
      duration: exp.duration || '',
      description: exp.description || '',
      location: exp.location || ''
    })).slice(0, 8)

    // Map Education
    const education = (data.education || []).map((edu: any) => ({
      school: edu.school || '',
      degree: edu.degree || '',
      field: edu.field_of_study || ''
    })).slice(0, 3)

    // Map Skills (Top skills usually in basic_info or separate)
    const skills = basic.top_skills || []

    const currentPosition = experience.find((e: any) => e.is_current) || experience[0]

    return {
      firstName: basic.first_name || basic.fullname?.split(' ')[0] || '',
      lastName: basic.last_name || basic.fullname?.split(' ').slice(1).join(' ') || '',
      headline: basic.headline || '',
      summary: basic.about || '',
      location: basic.location?.full || basic.location?.country || '',
      company: basic.current_company || currentPosition?.company || '',
      jobTitle: currentPosition?.title || basic.headline || '',
      experience,
      education,
      skills,
      profileUrl: basic.profile_url || `https://linkedin.com/in/${username}`,
      source: 'realtime'
    }

  } catch (error) {
    console.error('[LinkedIn] Real-Time API Exception:', error)
    return null
  }
}

/**
 * Strategy B: ScrapeNinja (HTML Parsing)
 */
async function fetchScrapeNinjaProfile(profileUrl: string): Promise<LinkedInProfile | null> {
  const rapidApiKey = process.env.RAPIDAPI_KEY
  if (!rapidApiKey) return null

  try {
    console.log('[LinkedIn] Calling ScrapeNinja...')
    const response = await fetch('https://scrapeninja.p.rapidapi.com/scrape', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'scrapeninja.p.rapidapi.com'
      },
      body: JSON.stringify({ url: profileUrl })
    })

    if (!response.ok) return null
    const json = await response.json()
    const html = json.body || ''

    return parseScrapeNinjaHtml(html, profileUrl)
  } catch (error) {
    console.error('[LinkedIn] ScrapeNinja Exception:', error)
    return null
  }
}

/**
 * Parse ScrapeNinja HTML response to extract Schema.org data
 */
function parseScrapeNinjaHtml(html: string, profileUrl: string): LinkedInProfile | null {
  try {
    const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)
    if (!match || !match[1]) return null

    const rawData = JSON.parse(match[1])
    const graph = rawData['@graph'] || []
    const person = graph.find((node: any) => node['@type'] === 'Person')

    if (!person) return null

    const firstName = person.name?.split(' ')[0] || ''
    const lastName = person.name?.split(' ').slice(1).join(' ') || ''
    const headline = person.jobTitle?.sort ? person.jobTitle[0] : (person.jobTitle || '')

    const worksFor = person.worksFor || []
    const experience = worksFor.map((org: any) => ({
      title: org.member?.description || headline || 'Employee',
      company: org.name,
      duration: 'Present',
      description: ''
    })).slice(0, 5)

    const alumniOf = person.alumniOf || []
    const education = alumniOf.map((school: any) => ({
      school: school.name,
      degree: '',
      field: ''
    })).slice(0, 3)

    return {
      firstName,
      lastName,
      headline: Array.isArray(person.jobTitle) ? person.jobTitle.join(' - ') : person.jobTitle || '',
      summary: person.description || '',
      location: person.address?.addressLocality || '',
      company: experience[0]?.company || '',
      jobTitle: experience[0]?.title || headline,
      experience,
      education,
      skills: [],
      profileUrl,
      source: 'scrapeninja'
    }

  } catch (error) {
    return null
  }
}


/**
 * Extract username from LinkedIn URL
 */
function extractLinkedInUsername(url: string): string | null {
  try {
    const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Enrich a lead with comprehensive LinkedIn data and AI-generated persona
 */
export async function enrichLead(leadId: string, userId: string): Promise<boolean> {
  try {
    console.log('[LinkedIn] Starting enhanced enrichment for leadId:', leadId)
    const lead = await prisma.lead.findFirst({ where: { id: leadId, userId } })

    if (!lead || !lead.linkedinUrl) {
      console.log('[LinkedIn] Skipped: No LinkedIn URL')
      return false
    }

    const profile = await fetchLinkedInProfile(lead.linkedinUrl, '')

    // Fallback if APIs fail: Generate basic persona from existing lead data
    if (!profile) {
      console.log('[LinkedIn] APIs failed, generating persona from basic lead data...')
      const basicData: EnhancedLinkedInData = {
        firstName: lead.firstName,
        lastName: lead.lastName,
        headline: lead.jobTitle ? `${lead.jobTitle} at ${lead.company || 'Unknown'}` : undefined,
        company: lead.company || undefined,
        jobTitle: lead.jobTitle || undefined,
        profileUrl: lead.linkedinUrl,
        companyInfo: lead.company ? { name: lead.company } : undefined,
        recentPosts: [],
        enrichedAt: new Date().toISOString(),
        enrichmentVersion: '2.0-basic',
      }
      const persona = await generatePersona(basicData)
      basicData.persona = persona

      await prisma.lead.update({
        where: { id: leadId },
        data: { linkedinEnriched: true, linkedinData: basicData as any },
      })
      return true
    }

    // Build enhanced data structure from Profile
    const enhancedData: EnhancedLinkedInData = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      headline: profile.headline,
      summary: profile.summary,
      location: profile.location,
      profileUrl: profile.profileUrl,
      company: profile.company,
      jobTitle: profile.jobTitle,
      companyInfo: { name: profile.company || '' },
      experience: profile.experience,
      education: profile.education,
      skills: profile.skills,
      recentPosts: [],
      enrichedAt: new Date().toISOString(),
      enrichmentVersion: `2.0-${profile.source}`,
    }

    // Generate AI persona
    console.log(`[LinkedIn] Generating AI persona using ${profile.source} data...`)
    const persona = await generatePersona(enhancedData)
    enhancedData.persona = persona
    console.log('[LinkedIn] Persona generated - DISC:', persona.discProfile)

    // Update lead
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        linkedinEnriched: true,
        linkedinData: enhancedData as any,
        company: profile.company || lead.company,
        jobTitle: profile.jobTitle || lead.jobTitle,
      },
    })

    console.log('[LinkedIn] Lead enriched successfully.')
    return true
  } catch (error) {
    console.error('[LinkedIn] Enrich lead error:', error)
    return false
  }
}

/**
 * Build contextual call script using LinkedIn data and persona
 */
export function buildContextualScript(
  baseScript: string,
  leadData: any,
  linkedinData?: EnhancedLinkedInData
): string {
  if (!linkedinData) return baseScript

  let contextualScript = baseScript

  // Add context about their current role
  if (linkedinData.jobTitle && linkedinData.company) {
    contextualScript += `\n\n=== PROSPECT CONTEXT ===\n${leadData.firstName} is currently ${linkedinData.jobTitle} at ${linkedinData.company}.`
  }

  // Add location
  if (linkedinData.location) {
    contextualScript += `\nLocation: ${linkedinData.location}`
  }

  // Add persona-based guidance
  if (linkedinData.persona) {
    const persona = linkedinData.persona

    contextualScript += `\n\n=== COMMUNICATION GUIDANCE ===`
    contextualScript += `\nPersonality Type: ${persona.discProfile}`
    contextualScript += `\nApproach: ${persona.approachRecommendation}`

    // Strategic Talking Points
    if (persona.strategicPrep && persona.strategicPrep.highValueTalkingPoints) {
      contextualScript += `\n\nStrategic Talking Points:\n${persona.strategicPrep.highValueTalkingPoints.map((p: string) => `- ${p}`).join('\n')}`
    } else if (persona.talkingPoints && persona.talkingPoints.length > 0) {
      contextualScript += `\n\nSuggested Talking Points:\n${persona.talkingPoints.map(tp => `- ${tp}`).join('\n')}`
    }
  }

  return contextualScript
}

// Re-export types
export type { EnhancedLinkedInData, LinkedInPost, CompanyInfo, PersonaProfile } from './persona-generator'
