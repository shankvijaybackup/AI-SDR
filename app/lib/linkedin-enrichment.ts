
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
  companyInfo?: {
    name: string
    industry?: string
    website?: string
  }
}

export interface LinkedInCompany {
  name: string
  description?: string
  industry?: string
  employeeCount?: number | string
  website?: string
  location?: string
  founded?: string
  specialties?: string[]
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
      // Continued execution to Account Creation...
    } else {
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
    }

    console.log('[LinkedIn] Lead enriched successfully.')

    // POST-ENRICHMENT: Link/Create Account and Trigger Deep Research
    const companyName = profile?.company || lead.company;
    if (companyName) {
      // Common logic for Account creation
      console.log(`[LinkedIn] Attempting to link Account for: ${companyName}`);
      let account = await prisma.account.findFirst({
        where: {
          name: { contains: companyName, mode: 'insensitive' },
          ownerId: userId
        }
      });

      if (!account) {
        console.log(`[LinkedIn] Creating new Account for: ${companyName}`);
        account = await prisma.account.create({
          data: {
            name: companyName,
            ownerId: userId,
            domain: profile?.companyInfo?.website || '',
            location: profile?.location || '',
            industry: profile?.companyInfo?.industry || '',
          }
        });
      }

      // Link Lead to Account
      if (account) {
        await prisma.lead.update({
          where: { id: leadId },
          data: { account: { connect: { id: account.id } } }
        });

        // Trigger Account Enrichment (which triggers Deep Research)
        // Run in background to not block response
        enrichAccount(account.id).catch(err =>
          console.error('[LinkedIn] Background Account Enrichment failed:', err)
        );
      }
    }

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

// ==================== ACCOUNT ENRICHMENT ====================

import { performDeepResearch } from './account-research';

export async function enrichAccount(accountId: string): Promise<boolean> {
  console.log(`[Enrichment] Starting enrichment for account ${accountId}`);
  try {
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return false;

    // Determine Company Identifier (LinkedIn URL or Domain)
    let identifier = account.linkedinUrl || account.domain;
    if (!identifier) {
      if (account.name) {
        console.warn(`[Enrichment] No domain or LinkedIn URL for account ${account.name}`);
        return false;
      }
      return false;
    }

    console.log(`[Enrichment] Fetching company data for ${identifier}`);
    const companyData = await fetchLinkedInCompany(identifier);

    if (companyData) {
      await prisma.account.update({
        where: { id: accountId },
        data: {
          enriched: true,
          industry: companyData.industry || account.industry,
          employeeCount: typeof companyData.employeeCount === 'number' ? companyData.employeeCount : undefined,
          location: companyData.location || account.location,
          enrichmentData: companyData as any,
          updatedAt: new Date()
        }
      });
      console.log(`[Enrichment] Account ${account.name} enriched successfully.`);

      // TRIGGER DEEP CONTEXT AWARE RESEARCH
      if (account.ownerId) {
        try {
          console.log(`[Enrichment] Triggering Deep Research for ${account.name}...`);
          await performDeepResearch(accountId, account.ownerId);
        } catch (drError) {
          console.error('[Enrichment] Deep Research Failed:', drError);
          // Don't fail the whole enrichment if deep research fails
        }
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error(`[Enrichment] Error enriching account ${accountId}:`, error);
    return false;
  }
}

async function fetchLinkedInCompany(identifier: string): Promise<LinkedInCompany | null> {
  // Reuse ScrapeNinja for Company
  // Note: ScrapeNinja usually supports /company/ URL

  if (identifier.includes('linkedin.com') && !identifier.includes('/company/')) {
    // Possibly a human URL?
    return null;
  }

  // Convert domain to linkedin URL if needed? 
  // Complex. For now mostly rely on explicit LinkedIn URL.
  // If identifier is just "microsoft.com", we might not easily find the LI page without Search.

  // Implementation: Use ScrapeNinja with custom generic extractor or specific company endpoint?
  // Since we don't have a specific Company API set up in this file, we'll try ScrapeNinja with a company URL.

  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) return null;

  try {
    // If it's a domain, we might need a search step. Skipping for MVP.
    // Assume identifier is a LinkedIn URL.
    if (!identifier.includes('linkedin.com/company')) {
      console.warn('[LinkedIn] Identifier is not a company URL. Skipping.');
      return null;
    }

    const host = 'scrapeninja.p.rapidapi.com';
    const url = `https://${host}/scrape-js`;

    // ScrapeNinja JS rendering
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rapidapi-host': host,
        'x-rapidapi-key': rapidApiKey
      },
      body: JSON.stringify({
        url: identifier,
        headers: ["User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"],
        render_js: false, // Company pages often static enough? Or safer with true?
        // Basic extraction script or returning HTML?
        // Returning HTML and parsing is hard here.
        // Ideally use the "Real-Time LinkedIn Scraper" (RocketAPI etc) which has a proper Company endpoint.
      })
    });

    // NOTE: This implementation is a placeholder because parsing raw HTML from ScrapeNinja is complex.
    // In a real scenario, I would use 'linkedin-scraper-api-real-time...' /company/details endpoint.
    // Let's switch to that if possible.

    return null; // Placeholder until we confirm API capability.
  } catch (e) {
    console.error(e);
    return null;
  }
}
