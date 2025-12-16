// LinkedIn profile enrichment service
import { prisma } from './prisma'

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
  }>
  education?: Array<{
    school: string
    degree?: string
    field?: string
  }>
  skills?: string[]
  profileUrl?: string
}

/**
 * Fetch LinkedIn profile data using session cookie
 */
export async function fetchLinkedInProfile(
  linkedinUrl: string,
  sessionCookie: string
): Promise<LinkedInProfile | null> {
  try {
    // Extract LinkedIn username from URL
    const username = extractLinkedInUsername(linkedinUrl)
    if (!username) {
      console.error('[LinkedIn] Invalid LinkedIn URL:', linkedinUrl)
      return null
    }

    console.log('[LinkedIn] Fetching profile for username:', username)

    // Use LinkedIn Voyager API (internal API used by LinkedIn's web app)
    const profileUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${username}/profileView`
    
    const response = await fetch(profileUrl, {
      headers: {
        'Cookie': `li_at=${sessionCookie}; JSESSIONID="ajax:${Math.random().toString(36).substring(7)}"`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.linkedin.normalized+json+2.1',
        'Accept-Language': 'en-US,en;q=0.9',
        'x-li-lang': 'en_US',
        'x-restli-protocol-version': '2.0.0',
        'x-li-page-instance': 'urn:li:page:d_flagship3_profile_view_base;' + Math.random().toString(36).substring(7),
        'csrf-token': sessionCookie.substring(0, 20),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[LinkedIn] API error:', response.status, response.statusText)
      console.error('[LinkedIn] Error details:', errorText.substring(0, 200))
      return null
    }

    const data = await response.json()
    
    // Parse LinkedIn API response
    const profile = parseLinkedInProfile(data)
    return profile
  } catch (error) {
    console.error('[LinkedIn] Enrichment error:', error)
    return null
  }
}

/**
 * Extract username from LinkedIn URL
 */
function extractLinkedInUsername(url: string): string | null {
  try {
    const patterns = [
      /linkedin\.com\/in\/([^\/\?]+)/,
      /linkedin\.com\/profile\/view\?id=([^&]+)/,
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Parse LinkedIn Voyager API response
 */
function parseLinkedInProfile(data: any): LinkedInProfile {
  const profile = data?.profile || data
  const firstName = profile?.firstName || ''
  const lastName = profile?.lastName || ''
  const headline = profile?.headline || ''
  const summary = profile?.summary || ''
  
  // Extract current position
  const positions = profile?.profilePositionGroups?.elements || []
  const currentPosition = positions[0]?.profilePositionInPositionGroup?.elements?.[0]
  
  const experience = positions.map((group: any) => {
    const pos = group?.profilePositionInPositionGroup?.elements?.[0]
    return {
      title: pos?.title || '',
      company: pos?.companyName || '',
      duration: formatDuration(pos?.timePeriod),
      description: pos?.description || '',
    }
  }).filter((exp: any) => exp.title)

  // Extract education
  const educations = profile?.profileEducations?.elements || []
  const education = educations.map((edu: any) => ({
    school: edu?.schoolName || '',
    degree: edu?.degreeName || '',
    field: edu?.fieldOfStudy || '',
  })).filter((edu: any) => edu.school)

  // Extract skills
  const skills = profile?.profileSkills?.elements?.map((skill: any) => 
    skill?.name || ''
  ).filter(Boolean) || []

  return {
    firstName,
    lastName,
    headline,
    summary,
    location: profile?.geoLocation || profile?.locationName || '',
    company: currentPosition?.companyName || '',
    jobTitle: currentPosition?.title || '',
    experience,
    education,
    skills: skills.slice(0, 10), // Top 10 skills
    profileUrl: profile?.publicIdentifier ? `https://linkedin.com/in/${profile.publicIdentifier}` : '',
  }
}

/**
 * Format time period
 */
function formatDuration(timePeriod: any): string | undefined {
  if (!timePeriod) return undefined
  
  const start = timePeriod.startDate
  const end = timePeriod.endDate
  
  if (!start) return undefined
  
  const startStr = `${start.month || ''}/${start.year || ''}`
  const endStr = end ? `${end.month || ''}/${end.year || ''}` : 'Present'
  
  return `${startStr} - ${endStr}`
}

/**
 * Enrich a lead with LinkedIn data
 */
export async function enrichLead(leadId: string, userId: string): Promise<boolean> {
  try {
    console.log('[LinkedIn] Starting enrichment for leadId:', leadId, 'userId:', userId)
    
    // Get lead and user's LinkedIn session
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, userId },
    })

    console.log('[LinkedIn] Lead found:', lead ? 'yes' : 'no')
    if (lead) {
      console.log('[LinkedIn] Lead has LinkedIn URL:', lead.linkedinUrl ? 'yes' : 'no', lead.linkedinUrl)
    }

    if (!lead || !lead.linkedinUrl) {
      console.log('[LinkedIn] Lead missing or no LinkedIn URL')
      return false
    }

    if (lead.linkedinEnriched) {
      console.log('[LinkedIn] Lead already enriched')
      return true
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { linkedinSessionCookie: true },
    })

    console.log('[LinkedIn] User found:', user ? 'yes' : 'no')
    console.log('[LinkedIn] Has session cookie:', user?.linkedinSessionCookie ? 'yes (length: ' + user.linkedinSessionCookie.length + ')' : 'no')

    if (!user?.linkedinSessionCookie) {
      console.log('[LinkedIn] No session cookie available')
      return false
    }

    // Fetch LinkedIn profile
    console.log('[LinkedIn] Enriching lead:', lead.firstName, lead.lastName)
    const profile = await fetchLinkedInProfile(lead.linkedinUrl, user.linkedinSessionCookie)

    if (!profile) {
      console.log('[LinkedIn] Failed to fetch profile')
      return false
    }

    // Update lead with enriched data
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        linkedinEnriched: true,
        linkedinData: profile as any,
        company: profile.company || lead.company,
        jobTitle: profile.jobTitle || lead.jobTitle,
      },
    })

    console.log('[LinkedIn] Lead enriched successfully')
    return true
  } catch (error) {
    console.error('[LinkedIn] Enrich lead error:', error)
    return false
  }
}

/**
 * Build contextual call script using LinkedIn data
 */
export function buildContextualScript(
  baseScript: string,
  leadData: any,
  linkedinData?: any
): string {
  if (!linkedinData) return baseScript

  let contextualScript = baseScript

  // Add context about their current role
  if (linkedinData.jobTitle && linkedinData.company) {
    const roleContext = `\n\nContext: ${leadData.firstName} is currently ${linkedinData.jobTitle} at ${linkedinData.company}.`
    contextualScript += roleContext
  }

  // Add context about their background
  if (linkedinData.experience && linkedinData.experience.length > 1) {
    const prevRole = linkedinData.experience[1]
    if (prevRole.title && prevRole.company) {
      const backgroundContext = `\nPreviously worked as ${prevRole.title} at ${prevRole.company}.`
      contextualScript += backgroundContext
    }
  }

  // Add context about their skills
  if (linkedinData.skills && linkedinData.skills.length > 0) {
    const relevantSkills = linkedinData.skills.slice(0, 5).join(', ')
    const skillsContext = `\nKey skills: ${relevantSkills}.`
    contextualScript += skillsContext
  }

  // Add headline for additional context
  if (linkedinData.headline) {
    const headlineContext = `\nLinkedIn headline: "${linkedinData.headline}"`
    contextualScript += headlineContext
  }

  return contextualScript
}
