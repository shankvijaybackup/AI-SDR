// LinkedIn profile enrichment service
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
 * Tries multiple approaches: Voyager API, then HTML scraping fallback
 */
export async function fetchLinkedInProfile(
  linkedinUrl: string,
  sessionCookie: string
): Promise<LinkedInProfile | null> {
  // Extract LinkedIn username from URL
  const username = extractLinkedInUsername(linkedinUrl)
  if (!username) {
    console.error('[LinkedIn] Invalid LinkedIn URL:', linkedinUrl)
    return null
  }

  console.log('[LinkedIn] Fetching profile for username:', username)

  // Try Voyager API first
  let profile = await tryVoyagerApi(username, sessionCookie)

  // If Voyager fails, try the profile page scraping
  if (!profile) {
    console.log('[LinkedIn] Voyager API failed, trying profile page scraping...')
    profile = await tryProfilePageScraping(username, sessionCookie)
  }

  // If both fail, try a simpler public data fetch
  if (!profile) {
    console.log('[LinkedIn] Profile scraping failed, trying public data...')
    profile = await tryPublicProfileData(linkedinUrl)
  }

  return profile
}

/**
 * Try Voyager API (LinkedIn internal API)
 */
async function tryVoyagerApi(username: string, sessionCookie: string): Promise<LinkedInProfile | null> {
  try {
    const profileUrl = `https://www.linkedin.com/voyager/api/identity/profiles/${username}/profileView`

    const response = await fetch(profileUrl, {
      headers: {
        'Cookie': `li_at=${sessionCookie}; JSESSIONID="ajax:${Math.random().toString(36).substring(7)}"`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.linkedin.normalized+json+2.1',
        'Accept-Language': 'en-US,en;q=0.9',
        'x-li-lang': 'en_US',
        'x-restli-protocol-version': '2.0.0',
        'x-li-page-instance': 'urn:li:page:d_flagship3_profile_view_base;' + Math.random().toString(36).substring(7),
        'csrf-token': sessionCookie.substring(0, 20),
      },
    })

    if (!response.ok) {
      console.error('[LinkedIn] Voyager API error:', response.status, response.statusText)
      return null
    }

    const data = await response.json()
    return parseVoyagerResponse(data)
  } catch (error) {
    console.error('[LinkedIn] Voyager API error:', error)
    return null
  }
}

/**
 * Try scraping profile page HTML
 */
async function tryProfilePageScraping(username: string, sessionCookie: string): Promise<LinkedInProfile | null> {
  try {
    const profileUrl = `https://www.linkedin.com/in/${username}/`

    const response = await fetch(profileUrl, {
      headers: {
        'Cookie': `li_at=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      console.error('[LinkedIn] Profile page error:', response.status)
      return null
    }

    const html = await response.text()
    return parseProfileHtml(html, username)
  } catch (error) {
    console.error('[LinkedIn] Profile page scraping error:', error)
    return null
  }
}

/**
 * Try fetching public profile data (no auth required)
 */
async function tryPublicProfileData(linkedinUrl: string): Promise<LinkedInProfile | null> {
  try {
    // Try to get basic info from meta tags
    const response = await fetch(linkedinUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html',
      },
    })

    if (!response.ok) return null

    const html = await response.text()

    // Extract from meta tags
    const titleMatch = html.match(/<title>([^|]+)\|/i)
    const descMatch = html.match(/<meta name="description" content="([^"]+)"/i)

    if (titleMatch) {
      const nameParts = titleMatch[1].trim().split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      return {
        firstName,
        lastName,
        headline: descMatch ? descMatch[1].substring(0, 200) : undefined,
        profileUrl: linkedinUrl,
      }
    }

    return null
  } catch (error) {
    console.error('[LinkedIn] Public data fetch error:', error)
    return null
  }
}

/**
 * Parse Voyager API response
 */
function parseVoyagerResponse(data: any): LinkedInProfile | null {
  try {
    // Try different data structures based on LinkedIn API version
    let profile = data?.profile || data?.data?.profile || data

    // Sometimes data is nested in 'included' array
    if (data?.included && Array.isArray(data.included)) {
      const profileData = data.included.find((item: any) =>
        item?.$type?.includes('Profile') || item?.firstName
      )
      if (profileData) profile = profileData
    }

    const firstName = profile?.firstName || profile?.localizedFirstName || ''
    const lastName = profile?.lastName || profile?.localizedLastName || ''

    if (!firstName && !lastName) {
      console.error('[LinkedIn] Could not parse profile data - no name found')
      return null
    }

    const headline = profile?.headline || profile?.localizedHeadline || ''
    const summary = profile?.summary || ''

    // Extract current position
    const positions = profile?.profilePositionGroups?.elements ||
      profile?.positionView?.elements ||
      []
    const currentPosition = positions[0]?.profilePositionInPositionGroup?.elements?.[0] ||
      positions[0]

    const experience = positions.slice(0, 5).map((group: any) => {
      const pos = group?.profilePositionInPositionGroup?.elements?.[0] || group
      return {
        title: pos?.title || '',
        company: pos?.companyName || pos?.company?.name || '',
        duration: formatDuration(pos?.timePeriod),
        description: pos?.description || '',
      }
    }).filter((exp: any) => exp.title || exp.company)

    // Extract education
    const educations = profile?.profileEducations?.elements ||
      profile?.educationView?.elements ||
      []
    const education = educations.slice(0, 3).map((edu: any) => ({
      school: edu?.schoolName || edu?.school?.name || '',
      degree: edu?.degreeName || '',
      field: edu?.fieldOfStudy || '',
    })).filter((edu: any) => edu.school)

    // Extract skills
    const skillElements = profile?.profileSkills?.elements ||
      profile?.skillView?.elements ||
      []
    const skills = skillElements.map((skill: any) =>
      skill?.name || skill?.skill?.name || ''
    ).filter(Boolean).slice(0, 10)

    return {
      firstName,
      lastName,
      headline,
      summary,
      location: profile?.geoLocation || profile?.locationName || profile?.geoLocationName || '',
      company: currentPosition?.companyName || currentPosition?.company?.name || '',
      jobTitle: currentPosition?.title || '',
      experience,
      education,
      skills,
      profileUrl: profile?.publicIdentifier ? `https://linkedin.com/in/${profile.publicIdentifier}` : '',
    }
  } catch (error) {
    console.error('[LinkedIn] Parse error:', error)
    return null
  }
}

/**
 * Parse profile HTML for data (fallback)
 */
function parseProfileHtml(html: string, username: string): LinkedInProfile | null {
  try {
    // Look for JSON-LD data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([^<]+)<\/script>/i)
    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1])
        if (jsonData['@type'] === 'Person' || jsonData.name) {
          const nameParts = (jsonData.name || '').split(' ')
          return {
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            headline: jsonData.jobTitle || '',
            company: jsonData.worksFor?.name || '',
            jobTitle: jsonData.jobTitle || '',
            location: jsonData.address?.addressLocality || '',
            profileUrl: `https://linkedin.com/in/${username}`,
          }
        }
      } catch (e) {
        // JSON parse failed, continue to regex fallback
      }
    }

    // Regex fallback for title
    const titleMatch = html.match(/<title>([^|<]+)/i)
    if (titleMatch) {
      const nameParts = titleMatch[1].trim().replace(' - ', ' ').split(' ')
      return {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1, -1).join(' ') || '',
        headline: nameParts[nameParts.length - 1] || '',
        profileUrl: `https://linkedin.com/in/${username}`,
      }
    }

    return null
  } catch (error) {
    console.error('[LinkedIn] HTML parse error:', error)
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
 * Fetch recent posts/activity for a LinkedIn profile
 */
async function fetchLinkedInPosts(
  username: string,
  sessionCookie: string
): Promise<LinkedInPost[]> {
  try {
    console.log('[LinkedIn] Fetching posts for:', username)

    // Try Voyager API for posts
    const postsUrl = `https://www.linkedin.com/voyager/api/identity/profileUpdatesV2?count=10&includeLongTermHistory=true&moduleKey=creator_profile_all_content_view%3Adesktop&numComments=0&profileUrn=urn%3Ali%3Afsd_profile%3A${username}&q=memberShareFeed`

    const response = await fetch(postsUrl, {
      headers: {
        'Cookie': `li_at=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.linkedin.normalized+json+2.1',
        'x-li-lang': 'en_US',
        'x-restli-protocol-version': '2.0.0',
        'csrf-token': sessionCookie.substring(0, 20),
      },
    })

    if (!response.ok) {
      console.log('[LinkedIn] Posts API returned:', response.status)
      return []
    }

    const data = await response.json()
    const posts: LinkedInPost[] = []

    // Parse posts from response
    const elements = data?.elements || data?.included || []
    for (const element of elements) {
      if (element?.commentary?.text?.text || element?.text) {
        posts.push({
          text: element?.commentary?.text?.text || element?.text || '',
          date: element?.createdAt ? new Date(element.createdAt).toISOString() : undefined,
          engagement: {
            likes: element?.socialDetail?.totalSocialActivityCounts?.numLikes || 0,
            comments: element?.socialDetail?.totalSocialActivityCounts?.numComments || 0,
          },
          topics: extractTopicsFromText(element?.commentary?.text?.text || element?.text || '')
        })
      }
    }

    console.log('[LinkedIn] Found', posts.length, 'posts')
    return posts.slice(0, 5) // Return max 5 posts
  } catch (error) {
    console.error('[LinkedIn] Posts fetch error:', error)
    return []
  }
}

/**
 * Extract topics from post text
 */
function extractTopicsFromText(text: string): string[] {
  const topics: string[] = []

  // Extract hashtags
  const hashtags = text.match(/#\w+/g) || []
  topics.push(...hashtags.map(h => h.substring(1)))

  // Common business topics
  const topicKeywords = [
    'AI', 'leadership', 'sales', 'marketing', 'growth', 'strategy',
    'product', 'innovation', 'technology', 'automation', 'data',
    'customer', 'success', 'hiring', 'culture', 'startup', 'SaaS'
  ]

  const lowerText = text.toLowerCase()
  topicKeywords.forEach(keyword => {
    if (lowerText.includes(keyword.toLowerCase())) {
      topics.push(keyword)
    }
  })

  return [...new Set(topics)].slice(0, 5)
}

/**
 * Fetch company information
 */
async function fetchCompanyInfo(
  companyName: string,
  sessionCookie: string
): Promise<CompanyInfo | null> {
  try {
    console.log('[LinkedIn] Fetching company info for:', companyName)

    // Search for company
    const searchUrl = `https://www.linkedin.com/voyager/api/search/blended?keywords=${encodeURIComponent(companyName)}&origin=GLOBAL_SEARCH_HEADER&q=all&filters=List((key:resultType,value:List(COMPANIES)))`

    const response = await fetch(searchUrl, {
      headers: {
        'Cookie': `li_at=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/vnd.linkedin.normalized+json+2.1',
        'x-li-lang': 'en_US',
        'x-restli-protocol-version': '2.0.0',
        'csrf-token': sessionCookie.substring(0, 20),
      },
    })

    if (!response.ok) {
      console.log('[LinkedIn] Company search returned:', response.status)
      return { name: companyName }
    }

    const data = await response.json()

    // Find company in results
    const included = data?.included || []
    const company = included.find((item: any) =>
      item?.name?.toLowerCase() === companyName.toLowerCase() ||
      item?.universalName?.toLowerCase() === companyName.toLowerCase().replace(/\s+/g, '')
    ) || included.find((item: any) => item?.industryName || item?.staffCountRange)

    if (company) {
      return {
        name: company.name || companyName,
        industry: company.industryName || undefined,
        size: company.staffCountRange?.start && company.staffCountRange?.end
          ? `${company.staffCountRange.start}-${company.staffCountRange.end} employees`
          : undefined,
        linkedinUrl: company.universalName
          ? `https://linkedin.com/company/${company.universalName}`
          : undefined,
        description: company.tagline || company.description || undefined,
        website: company.websiteUrl || undefined,
      }
    }

    return { name: companyName }
  } catch (error) {
    console.error('[LinkedIn] Company fetch error:', error)
    return { name: companyName }
  }
}

/**
 * Enrich a lead with comprehensive LinkedIn data and AI-generated persona
 */
export async function enrichLead(leadId: string, userId: string): Promise<boolean> {
  try {
    console.log('[LinkedIn] Starting enhanced enrichment for leadId:', leadId, 'userId:', userId)

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { linkedinSessionCookie: true },
    })

    console.log('[LinkedIn] User found:', user ? 'yes' : 'no')
    console.log('[LinkedIn] Has session cookie:', user?.linkedinSessionCookie ? 'yes' : 'no')

    if (!user?.linkedinSessionCookie) {
      console.log('[LinkedIn] No session cookie available')
      return false
    }

    // Extract username for API calls
    const username = extractLinkedInUsername(lead.linkedinUrl)
    if (!username) {
      console.log('[LinkedIn] Could not extract username')
      return false
    }

    // Fetch LinkedIn profile
    console.log('[LinkedIn] Enriching lead:', lead.firstName, lead.lastName)
    const profile = await fetchLinkedInProfile(lead.linkedinUrl, user.linkedinSessionCookie)

    // If LinkedIn fetch failed, generate persona from existing lead data
    if (!profile) {
      console.log('[LinkedIn] Failed to fetch LinkedIn profile, generating persona from lead data...')

      // Build basic data from lead info
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

      // Generate AI persona from available data
      console.log('[LinkedIn] Generating AI persona from lead data...')
      const persona = await generatePersona(basicData)
      basicData.persona = persona
      console.log('[LinkedIn] Basic persona generated - DISC:', persona.discProfile)

      // Update lead with basic enriched data
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          linkedinEnriched: true,
          linkedinData: basicData as any,
        },
      })

      console.log('[LinkedIn] Lead enriched with basic persona (LinkedIn fetch failed)')
      return true
    }

    // Fetch additional data in parallel
    const [posts, companyInfo] = await Promise.all([
      fetchLinkedInPosts(username, user.linkedinSessionCookie),
      profile.company
        ? fetchCompanyInfo(profile.company, user.linkedinSessionCookie)
        : Promise.resolve(null)
    ])

    // Build enhanced data structure
    const enhancedData: EnhancedLinkedInData = {
      firstName: profile.firstName,
      lastName: profile.lastName,
      headline: profile.headline,
      summary: profile.summary,
      location: profile.location,
      profileUrl: profile.profileUrl,
      company: profile.company,
      jobTitle: profile.jobTitle,
      companyInfo: companyInfo || (profile.company ? { name: profile.company } : undefined),
      experience: profile.experience,
      education: profile.education,
      skills: profile.skills,
      recentPosts: posts,
      enrichedAt: new Date().toISOString(),
      enrichmentVersion: '2.0',
    }

    // Generate AI persona
    console.log('[LinkedIn] Generating AI persona...')
    const persona = await generatePersona(enhancedData)
    enhancedData.persona = persona
    console.log('[LinkedIn] Persona generated - DISC:', persona.discProfile)

    // Update lead with enriched data
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        linkedinEnriched: true,
        linkedinData: enhancedData as any,
        company: profile.company || lead.company,
        jobTitle: profile.jobTitle || lead.jobTitle,
      },
    })

    console.log('[LinkedIn] Lead enriched successfully with persona')
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
    const roleContext = `\n\n=== PROSPECT CONTEXT ===\n${leadData.firstName} is currently ${linkedinData.jobTitle} at ${linkedinData.company}.`
    contextualScript += roleContext
  }

  // Add company context
  if (linkedinData.companyInfo) {
    let companyContext = ''
    if (linkedinData.companyInfo.industry) {
      companyContext += `\nCompany Industry: ${linkedinData.companyInfo.industry}`
    }
    if (linkedinData.companyInfo.size) {
      companyContext += `\nCompany Size: ${linkedinData.companyInfo.size}`
    }
    contextualScript += companyContext
  }

  // Add context about their background
  if (linkedinData.experience && linkedinData.experience.length > 1) {
    const prevRole = linkedinData.experience[1]
    if (prevRole.title && prevRole.company) {
      const backgroundContext = `\nPrevious Role: ${prevRole.title} at ${prevRole.company}`
      contextualScript += backgroundContext
    }
  }

  // Add skills context
  if (linkedinData.skills && linkedinData.skills.length > 0) {
    const relevantSkills = linkedinData.skills.slice(0, 5).join(', ')
    const skillsContext = `\nKey Skills: ${relevantSkills}`
    contextualScript += skillsContext
  }

  // Add headline
  if (linkedinData.headline) {
    const headlineContext = `\nLinkedIn Headline: "${linkedinData.headline}"`
    contextualScript += headlineContext
  }

  // Add persona-based guidance (most important for AI behavior)
  if (linkedinData.persona) {
    const persona = linkedinData.persona

    // NEW: Strategic Intelligence
    if (persona.executiveSnapshot) {
      contextualScript += `\n\n=== EXECUTIVE SNAPSHOT ===`
      contextualScript += `\nRole & Focus: ${persona.executiveSnapshot.roleAndFocus}`
      contextualScript += `\nPersona Read: ${persona.executiveSnapshot.personaRead}`
      contextualScript += `\nCore Strengths: ${persona.executiveSnapshot.coreStrengths.join(', ')}`
    }

    if (persona.signals) {
      contextualScript += `\n\n=== BUYING SIGNALS ===`
      contextualScript += `\nCommercial Lens: ${persona.signals.commercialLens}`
      contextualScript += `\nContent Analysis: ${persona.signals.contentAnalysis}`
    }

    if (persona.strategicPrep) {
      contextualScript += `\n\n=== STRATEGIC PREP ===`
      contextualScript += `\nConnection Angle: ${persona.strategicPrep.connectionAngle}`
      contextualScript += `\nCommon Ground: ${persona.strategicPrep.commonGround}`
      contextualScript += `\nHigh-Value Talking Points:\n${persona.strategicPrep.highValueTalkingPoints?.map((p: string) => `- ${p}`).join('\n')}`
      contextualScript += `\nSmart Questions:\n${persona.strategicPrep.smartQuestions?.map((q: string) => `- ${q}`).join('\n')}`
    }

    if (persona.internalCoaching) {
      contextualScript += `\n\n=== INTERNAL COACHING ===`
      contextualScript += `\nHow to Win: ${persona.internalCoaching.howToWin?.join(' | ')}`
      contextualScript += `\nPitfalls to Avoid: ${persona.internalCoaching.pitfallsAvoid?.join(' | ')}`
    }

    contextualScript += `\n\n=== COMMUNICATION GUIDANCE ===`
    contextualScript += `\nPersonality Type: ${persona.discProfile} - ${persona.discDescription}`
    contextualScript += `\nCommunication Style: ${persona.communicationStyle}`
    contextualScript += `\n\n${persona.approachRecommendation}`

    if (persona.focusAreas?.length > 0) {
      contextualScript += `\n\nTheir Focus Areas: ${persona.focusAreas.join(', ')}`
    }

    if (persona.painPoints && persona.painPoints.length > 0) {
      contextualScript += `\nLikely Pain Points: ${persona.painPoints.join(', ')}`
    }

    if (persona.talkingPoints?.length > 0) {
      contextualScript += `\n\nSuggested Talking Points:\n${persona.talkingPoints.map(tp => `- ${tp}`).join('\n')}`
    }

    if (persona.motivators && persona.motivators.length > 0) {
      contextualScript += `\n\nMotivators: ${persona.motivators.join(', ')}`
    }
  }

  // Add recent posts context
  if (linkedinData.recentPosts && linkedinData.recentPosts.length > 0) {
    const postTopics = linkedinData.recentPosts
      .flatMap(p => p.topics || [])
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 5)

    if (postTopics.length > 0) {
      contextualScript += `\n\nRecent Topics They Post About: ${postTopics.join(', ')}`
    }
  }

  return contextualScript
}

// Re-export types for use in other modules
export type { EnhancedLinkedInData, LinkedInPost, CompanyInfo, PersonaProfile } from './persona-generator'

