/**
 * LinkedIn Lead Enrichment Service
 *
 * Scrapes LinkedIn profiles and generates strategic intelligence for sales conversations
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LINKEDIN_COOKIE = process.env.LINKEDIN_COOKIE;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

/**
 * Main function to enrich a lead with LinkedIn data
 */
export async function enrichLeadWithLinkedIn(leadId, prisma) {
    try {
        console.log(`[LinkedIn] Starting enrichment for lead ${leadId}`);

        if (!prisma) {
            throw new Error('Prisma client is required');
        }

        // Get lead from database
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: { account: true }
        });

        if (!lead) {
            throw new Error('Lead not found');
        }

        // Check if we have enough data to enrich
        const hasLinkedInUrl = !!lead.linkedinUrl;
        const hasPersonData = lead.firstName && lead.lastName && lead.company;

        if (!hasLinkedInUrl && !hasPersonData) {
            throw new Error('Lead needs either: (1) LinkedIn URL, or (2) firstName + lastName + company for enrichment');
        }

        if (!RAPIDAPI_KEY && !LINKEDIN_COOKIE) {
            throw new Error('LinkedIn enrichment not configured. Add RAPIDAPI_KEY or LINKEDIN_COOKIE to .env');
        }

        // Scrape LinkedIn profile (pass lead data for person-match)
        console.log(`[LinkedIn] Scraping profile: ${lead.linkedinUrl || `${lead.firstName} ${lead.lastName} at ${lead.company}`}`);
        const profileData = await scrapeLinkedInProfile(lead.linkedinUrl, lead);

        // Generate strategic persona analysis
        console.log('[LinkedIn] Generating strategic intelligence...');
        const persona = await generateStrategicPersona(profileData, lead);

        // Update lead with enrichment data
        const updatedLead = await prisma.lead.update({
            where: { id: leadId },
            data: {
                linkedinEnriched: true,
                linkedinData: {
                    ...profileData,
                    persona
                },
                updatedAt: new Date()
            }
        });

        console.log(`[LinkedIn] ✅ Successfully enriched lead: ${lead.firstName} ${lead.lastName}`);

        // Auto-generate personalized call script
        try {
            console.log(`[LinkedIn] Generating personalized call script...`);
            const { generatePersonalizedScript } = await import('./scriptGeneration.js');
            const script = await generatePersonalizedScript(lead, persona);

            // Store script in lead data
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    generatedScript: script,
                    scriptStatus: 'pending_review'
                }
            });

            console.log(`[LinkedIn] ✅ Personalized call script generated`);
        } catch (scriptError) {
            console.error('[LinkedIn] Script generation failed:', scriptError.message);
            // Don't fail enrichment if script generation fails
        }

        return updatedLead;

    } catch (error) {
        console.error('[LinkedIn] Enrichment failed:', error.message);
        throw new Error(`Failed to enrich lead. ${error.message}`);
    }
}

/**
 * Scrape LinkedIn profile using RapidAPI or session cookie fallback
 */
async function scrapeLinkedInProfile(linkedinUrl, lead) {
    // Try RapidAPI Person Match first (doesn't need LinkedIn URL)
    if (RAPIDAPI_KEY && lead) {
        try {
            console.log('[LinkedIn] Using RapidAPI Person Match for enrichment...');
            return await scrapeWithRapidAPIPersonMatch(lead);
        } catch (error) {
            console.error('[LinkedIn] RapidAPI Person Match failed:', error.message);
            console.log('[LinkedIn] Trying LinkedIn URL-based methods...');
            // Continue to fallback methods
        }
    }

    // Try LinkedIn URL-based RapidAPI if URL is available
    if (RAPIDAPI_KEY && linkedinUrl) {
        try {
            console.log('[LinkedIn] Using RapidAPI LinkedIn URL enrichment...');
            return await scrapeWithRapidAPI(linkedinUrl);
        } catch (error) {
            console.error('[LinkedIn] RapidAPI URL enrichment failed:', error.message);
            console.log('[LinkedIn] Falling back to direct scraping...');
            // Continue to fallback method
        }
    }

    // Fallback: Direct scraping with session cookie
    try {
        console.log('[LinkedIn] Using direct scraping (may be blocked by LinkedIn)...');

        // Clean URL to ensure it's a profile URL
        const profileUrl = linkedinUrl.replace(/\/$/, '');

        const response = await axios.get(profileUrl, {
            headers: {
                'Cookie': `li_at=${LINKEDIN_COOKIE}`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.linkedin.com/',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none'
            },
            timeout: 15000,
            maxRedirects: 5
        });

        const $ = cheerio.load(response.data);

        // Extract profile data
        const profileData = {
            name: $('h1.text-heading-xlarge').first().text().trim() ||
                  $('.pv-text-details__left-panel h1').first().text().trim(),
            headline: $('.text-body-medium').first().text().trim() ||
                     $('.pv-text-details__left-panel .text-body-medium').first().text().trim(),
            location: $('[class*="location"]').first().text().trim(),
            about: $('[id*="about"] .inline-show-more-text').text().trim() ||
                   $('.pv-about-section .pv-about__summary-text').text().trim(),
            experience: [],
            education: [],
            skills: [],
            rawHtml: response.data
        };

        // Extract experience
        $('[id*="experience"]').find('.pvs-list__item--line-separated').each((i, elem) => {
            if (i >= 3) return false; // Only get last 3 jobs
            const exp = $(elem);
            profileData.experience.push({
                title: exp.find('[class*="t-bold"]').first().text().trim(),
                company: exp.find('[class*="t-14"]').first().text().trim(),
                duration: exp.find('[class*="t-black--light"]').first().text().trim()
            });
        });

        // Extract education
        $('[id*="education"]').find('.pvs-list__item--line-separated').each((i, elem) => {
            if (i >= 2) return false; // Only get last 2 schools
            const edu = $(elem);
            profileData.education.push({
                school: edu.find('[class*="t-bold"]').first().text().trim(),
                degree: edu.find('[class*="t-14"]').first().text().trim()
            });
        });

        // Extract skills
        $('[id*="skills"]').find('.pvs-list__item--one-column').each((i, elem) => {
            if (i >= 10) return false; // Top 10 skills
            profileData.skills.push($(elem).find('[class*="t-bold"]').first().text().trim());
        });

        console.log(`[LinkedIn] ✅ Scraped profile: ${profileData.name}`);
        return profileData;

    } catch (error) {
        console.error('[LinkedIn] Scrape failed:', error.message);

        if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error('LinkedIn session expired. Please update LINKEDIN_COOKIE.');
        }

        if (error.response?.status === 999) {
            throw new Error('LinkedIn blocked the request (anti-bot protection). Please add RAPIDAPI_KEY to .env file.');
        }

        throw new Error(`Failed to scrape LinkedIn profile: ${error.message}`);
    }
}

/**
 * Scrape LinkedIn profile using RapidAPI B2B Contact Data API (Person Match)
 * This is the PRIMARY method - uses firstName, lastName, companyName (no LinkedIn URL needed)
 */
async function scrapeWithRapidAPIPersonMatch(lead) {
    try {
        console.log(`[LinkedIn] Attempting person match: ${lead.firstName} ${lead.lastName} at ${lead.company}`);

        const response = await axios.post(
            'https://b2b-contact-data-profile-enrichment-api5.p.rapidapi.com/person-match',
            {
                firstName: lead.firstName,
                lastName: lead.lastName,
                companyName: lead.company
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'b2b-contact-data-profile-enrichment-api5.p.rapidapi.com'
                },
                timeout: 30000
            }
        );

        if (!response.data.success || !response.data.data?.person) {
            throw new Error('Person not found or API returned no data');
        }

        const person = response.data.data.person;

        // Format to match our schema
        const profileData = {
            name: `${person.firstName || lead.firstName} ${person.lastName || lead.lastName}`.trim(),
            headline: person.headline || '',
            location: person.location || '',
            about: person.summary || '',
            linkedinUrl: person.linkedInUrl || lead.linkedinUrl || '',
            experience: [],
            education: [],
            skills: [],
            rawData: person // Store full API response
        };

        // Extract experience from positions
        if (person.positions?.positionHistory && Array.isArray(person.positions.positionHistory)) {
            profileData.experience = person.positions.positionHistory.slice(0, 3).map(pos => {
                let duration = '';
                if (pos.startEndDate) {
                    const start = pos.startEndDate.start || '';
                    const end = pos.startEndDate.end || 'Present';
                    duration = start ? `${start} - ${end}` : end;
                }

                return {
                    title: pos.title || '',
                    company: pos.companyName || '',
                    duration: duration,
                    description: pos.description || ''
                };
            });
        }

        // Extract education from schools
        if (person.schools?.educationHistory && Array.isArray(person.schools.educationHistory)) {
            profileData.education = person.schools.educationHistory.slice(0, 2).map(edu => ({
                school: edu.schoolName || '',
                degree: edu.degreeName || edu.fieldOfStudy || ''
            }));
        }

        // Extract skills
        if (person.skills && Array.isArray(person.skills)) {
            profileData.skills = person.skills.slice(0, 10).map(skill =>
                typeof skill === 'string' ? skill : (skill.name || '')
            ).filter(s => s);
        }

        console.log(`[LinkedIn] ✅ Enriched via Person Match: ${profileData.name}`);
        return profileData;

    } catch (error) {
        console.error('[LinkedIn] Person Match API error:', error.response?.data || error.message);

        if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error('RapidAPI key is invalid. Please check RAPIDAPI_KEY in .env file.');
        }

        if (error.response?.status === 404 || !error.response?.data?.success) {
            throw new Error('Person not found. Try adding a LinkedIn URL to the lead.');
        }

        if (error.response?.status === 429) {
            throw new Error('RapidAPI rate limit exceeded. Please upgrade your subscription.');
        }

        throw new Error(`Person Match API failed: ${error.message}`);
    }
}

/**
 * Scrape LinkedIn profile using RapidAPI LinkedIn services (URL-based fallback)
 * Supports multiple RapidAPI LinkedIn providers:
 * - Fresh LinkedIn Profile Data (linkedin-data-api.p.rapidapi.com)
 * - LinkedIn Data Scraper (linkedin-data-scraper.p.rapidapi.com)
 * - LinkedIn API (linkedin-api8.p.rapidapi.com)
 */
async function scrapeWithRapidAPI(linkedinUrl) {
    try {
        // Try multiple RapidAPI LinkedIn endpoints in order of preference
        const endpoints = [
            {
                name: 'Fresh LinkedIn Profile Data',
                host: 'linkedin-data-api.p.rapidapi.com',
                url: 'https://linkedin-data-api.p.rapidapi.com/get-profile-data-by-url',
                method: 'GET',
                params: { url: linkedinUrl }
            },
            {
                name: 'LinkedIn Data Scraper',
                host: 'linkedin-data-scraper.p.rapidapi.com',
                url: 'https://linkedin-data-scraper.p.rapidapi.com/person',
                method: 'GET',
                params: { url: linkedinUrl }
            },
            {
                name: 'LinkedIn API',
                host: 'linkedin-api8.p.rapidapi.com',
                url: 'https://linkedin-api8.p.rapidapi.com/get-profile-data-by-url',
                method: 'GET',
                params: { url: linkedinUrl }
            }
        ];

        let lastError = null;

        for (const endpoint of endpoints) {
            try {
                console.log(`[LinkedIn] Trying ${endpoint.name}...`);

                const response = await axios({
                    method: endpoint.method,
                    url: endpoint.url,
                    params: endpoint.params,
                    headers: {
                        'X-RapidAPI-Key': RAPIDAPI_KEY,
                        'X-RapidAPI-Host': endpoint.host
                    },
                    timeout: 30000
                });

                const data = response.data;

                // Format RapidAPI data to match our schema
                const profileData = {
                    name: data.full_name || data.name || data.fullName ||
                          `${data.firstName || data.first_name || ''} ${data.lastName || data.last_name || ''}`.trim(),
                    headline: data.headline || data.title || data.tagline || '',
                    location: data.location || data.geo || data.city || '',
                    about: data.about || data.summary || data.description || '',
                    experience: [],
                    education: [],
                    skills: [],
                    rawData: data // Store full RapidAPI response
                };

                // Extract experience (last 3 positions)
                const experienceData = data.experiences || data.experience || data.positions || [];
                if (Array.isArray(experienceData) && experienceData.length > 0) {
                    profileData.experience = experienceData.slice(0, 3).map(exp => ({
                        title: exp.title || exp.position || '',
                        company: exp.company || exp.companyName || exp.company_name || '',
                        duration: exp.duration || exp.date || exp.time_period ||
                                 `${exp.start_date || exp.starts_at || ''} - ${exp.end_date || exp.ends_at || 'Present'}`
                    }));
                }

                // Extract education (last 2 schools)
                const educationData = data.education || data.educations || data.schools || [];
                if (Array.isArray(educationData) && educationData.length > 0) {
                    profileData.education = educationData.slice(0, 2).map(edu => ({
                        school: edu.school || edu.school_name || edu.institution || '',
                        degree: edu.degree || edu.degree_name || edu.field_of_study || edu.field || ''
                    }));
                }

                // Extract skills (top 10)
                const skillsData = data.skills || [];
                if (Array.isArray(skillsData) && skillsData.length > 0) {
                    profileData.skills = skillsData.slice(0, 10).map(skill =>
                        typeof skill === 'string' ? skill : (skill.name || skill.skill || '')
                    ).filter(s => s);
                }

                console.log(`[LinkedIn] ✅ Scraped profile via ${endpoint.name}: ${profileData.name}`);
                return profileData;

            } catch (error) {
                console.error(`[LinkedIn] ${endpoint.name} failed:`, error.response?.data?.message || error.message);
                lastError = error;
                // Continue to next endpoint
            }
        }

        // All endpoints failed
        throw lastError || new Error('All RapidAPI endpoints failed');

    } catch (error) {
        console.error('[LinkedIn] RapidAPI error:', error.response?.data || error.message);

        if (error.response?.status === 401 || error.response?.status === 403) {
            throw new Error('RapidAPI key is invalid or missing. Please check RAPIDAPI_KEY in .env file.');
        }

        if (error.response?.status === 404) {
            throw new Error('LinkedIn profile not found or is private.');
        }

        if (error.response?.status === 429) {
            throw new Error('RapidAPI rate limit exceeded. Please upgrade your RapidAPI subscription.');
        }

        throw new Error(`RapidAPI failed: ${error.message}`);
    }
}


/**
 * Generate strategic persona using multi-model synthesis (Claude + OpenAI)
 * Cross-validates facts and combines best insights from both models
 */
async function generateStrategicPersona(profileData, lead) {
    try {
        console.log('[LinkedIn] Generating persona with Claude...');
        const persona = await generatePersonaWithClaude(profileData, lead);
        console.log('[LinkedIn] ✅ Persona generation complete');
        return persona;
    } catch (error) {
        console.error('[LinkedIn] Persona generation failed:', error.message);
        return getBasicFallbackPersona(lead);
    }
}

/**
 * Generate persona using Claude Opus 4.5
 */
async function generatePersonaWithClaude(profileData, lead) {
    const systemPrompt = `You are an expert sales strategist and communication specialist.
Your role is to analyze professional background data and generate actionable intelligence for sales conversations.

Write professional, confident, natural language throughout.
NO labels, tags, or prefixes of any kind (no "[INFERENCE]", no "[FACT]", no asterisks).
When data is limited, reason intelligently from job title, company context, and industry norms — this is expected and valuable.
Produce clean JSON with plain string values. Be specific, concrete, and immediately useful to a sales rep.`;

    const userPrompt = buildEnrichmentPrompt(profileData, lead);

    const message = await anthropic.messages.create({
        model: "claude-opus-4-5-20251101",
        max_tokens: 4000,
        temperature: 0.6,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
    });

    const content = message.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

    // Attach generation metadata
    result.metadata = {
        approach: "claude-only",
        models: ["claude-opus-4-5"],
        timestamp: new Date().toISOString()
    };

    return result;
}

/**
 * Build enrichment prompt for Claude persona generation
 */
function buildEnrichmentPrompt(profileData, lead) {
    const name = profileData.name || `${lead.firstName} ${lead.lastName}`;
    const role = lead.jobTitle || profileData.headline || 'Executive';
    const company = lead.company || 'their company';
    const location = profileData.location || '';
    const about = profileData.about || '';

    const experienceBlock = profileData.experience && profileData.experience.length > 0
        ? profileData.experience.map(exp => `- ${exp.title} at ${exp.company}${exp.duration ? ` (${exp.duration})` : ''}`).join('\n')
        : `- Current: ${role} at ${company}`;

    const educationBlock = profileData.education && profileData.education.length > 0
        ? profileData.education.map(edu => `- ${edu.degree} from ${edu.school}`).join('\n')
        : 'Not available';

    const skillsBlock = profileData.skills && profileData.skills.length > 0
        ? profileData.skills.join(', ')
        : 'Not listed';

    return `Generate strategic sales intelligence for this professional:

NAME: ${name}
CURRENT ROLE: ${role}
COMPANY: ${company}
${location ? `LOCATION: ${location}` : ''}

CAREER HISTORY:
${experienceBlock}

EDUCATION:
${educationBlock}

SKILLS: ${skillsBlock}

${about ? `ABOUT / BIO:\n${about}` : ''}

Produce a strategic brief in this EXACT JSON structure (all values must be plain strings or string arrays — no labels, no prefixes):

{
  "discProfile": "D, I, S, or C",
  "discDescription": "One sentence describing their personality style and how they operate",
  "communicationStyle": "One sentence describing how they prefer to communicate and be approached",
  "executiveSnapshot": {
    "roleAndFocus": "What this person focuses on day-to-day based on their role and background",
    "coreStrengths": ["Specific strength 1", "Specific strength 2", "Specific strength 3"],
    "personaRead": "One sentence personality assessment — what makes them tick as a buyer"
  },
  "strategicPrep": {
    "connectionAngle": "Specific, natural way to open the first conversation with this person",
    "commonGround": "Genuine connection points based on their background",
    "smartQuestions": [
      "Specific question tailored to their role at ${company}",
      "Question about their strategic priorities",
      "Question to uncover pain or opportunity"
    ]
  },
  "internalCoaching": {
    "howToWin": [
      "Concrete action to take",
      "What to say or emphasize",
      "How to frame the value prop for them"
    ],
    "pitfallsAvoid": [
      "Specific thing to avoid with this person",
      "Tone or approach that won't land",
      "Topic or assumption to steer clear of"
    ]
  },
  "likelyPainPoints": [
    "Specific pain relevant to their role",
    "Challenge common to their industry or company stage",
    "Operational friction they likely face"
  ],
  "motivators": [
    "What drives them professionally",
    "What success looks like in their role",
    "What they care about beyond their title"
  ],
  "talkingPoints": [
    "Opening hook tied to their background",
    "Value angle relevant to their company",
    "Proof point or analogy that resonates with their world"
  ]
}

Be specific, confident, and immediately useful to a sales rep preparing for a cold call.`;
}


/**
 * Get basic fallback persona when all enrichment methods fail.
 * Uses available lead data to generate a minimal but clean persona.
 */
function getBasicFallbackPersona(lead) {
    const role = lead.jobTitle || 'Executive';
    const company = lead.company || 'their company';
    const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || 'this person';

    // Detect seniority from title
    const titleLower = role.toLowerCase();
    const isCxO = /\b(ceo|cto|cfo|coo|cpo|ciso|vp|svp|evp|president|founder|co-founder)\b/.test(titleLower);
    const isManager = /\b(director|head|manager|lead)\b/.test(titleLower);
    const discType = isCxO ? 'D' : isManager ? 'C' : 'S';
    const discDesc = isCxO
        ? 'Results-oriented and decisive — wants the punchline fast, not the full story'
        : isManager
        ? 'Analytical and methodical — values process, proof, and clear ROI'
        : 'Collaborative and relationship-driven — listens well and values trust';

    return {
        metadata: {
            approach: "fallback",
            models: [],
            timestamp: new Date().toISOString()
        },
        discProfile: discType,
        discDescription: discDesc,
        communicationStyle: isCxO
            ? 'Lead with business outcomes and bottom-line impact. Be brief and crisp.'
            : 'Be professional and structured. Support claims with data and evidence.',
        executiveSnapshot: {
            roleAndFocus: `${name} is ${role} at ${company}, focused on ${isCxO ? 'strategic direction, growth, and operational outcomes' : 'team execution and delivering measurable results'}.`,
            coreStrengths: [
                `Experienced ${role}`,
                isCxO ? 'Strategic decision-maker' : 'Operational discipline',
                'Accountable for team outcomes'
            ],
            personaRead: `A ${isCxO ? 'senior executive who moves fast and expects brevity' : 'professional who values substance over hype'} — earn their attention quickly.`
        },
        strategicPrep: {
            connectionAngle: `Open with a quick observation about challenges facing ${role}s at ${isCxO ? 'scaling companies' : 'their team level'} right now, then ask a pointed question.`,
            commonGround: `Other ${role}s at companies similar to ${company} have faced the same IT and employee experience challenges you solve.`,
            smartQuestions: [
                `What does your current IT service desk look like — are employees getting fast resolution or are tickets piling up?`,
                `How much time do your IT staff spend on repetitive L1 requests versus strategic work?`,
                `If you could change one thing about how your team handles service requests today, what would it be?`
            ]
        },
        internalCoaching: {
            howToWin: [
                `Open with a specific insight about ${company}'s size or industry, not a generic intro`,
                `Ask one sharp question and listen — let them do 60% of the talking`,
                `Tie Atomicwork to a business outcome they care about (speed, cost, employee experience)`
            ],
            pitfallsAvoid: [
                `Don't start with "We're an AI-powered ITSM..." — lead with their pain, not the product`,
                `Don't oversell. ${isCxO ? 'A C-suite exec will tune out at the first whiff of hype' : 'A manager will want evidence, not enthusiasm'}`,
                `Avoid asking for a full demo commitment on the first call — aim for curiosity and a next step`
            ]
        },
        likelyPainPoints: [
            `IT tickets taking too long to resolve, frustrating employees and slowing productivity`,
            `IT staff buried in repetitive L1 requests with no time for strategic initiatives`,
            `No visibility into employee service experience or resolution metrics`
        ],
        motivators: [
            `Making their team look good and removing blockers`,
            `Reducing overhead while maintaining or improving service quality`,
            `Being seen as forward-thinking — adopting AI in a way that actually works`
        ],
        talkingPoints: [
            `Atomicwork is an AI-native ITSM that lives inside Teams and Slack — no new tool for employees to learn`,
            `Customers like Pepper Money and Zuora saw 80%+ ticket deflection within 90 days`,
            `Founded by ex-Freshworks, Zoho, and Nutanix leaders — backed by Khosla Ventures ($40M raised)`
        ]
    };
}

/**
 * Batch enrich multiple leads
 */
export async function batchEnrichLeads(leadIds) {
    const results = [];

    for (const leadId of leadIds) {
        try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit: 2 seconds between requests
            const enrichedLead = await enrichLeadWithLinkedIn(leadId);
            results.push({ leadId, success: true, data: enrichedLead });
        } catch (error) {
            results.push({ leadId, success: false, error: error.message });
        }
    }

    return results;
}

/**
 * Check if LinkedIn session is valid
 */
export async function validateLinkedInSession() {
    if (!LINKEDIN_COOKIE) {
        return { valid: false, error: 'No LinkedIn cookie configured' };
    }

    try {
        const response = await axios.get('https://www.linkedin.com/feed/', {
            headers: {
                'Cookie': `li_at=${LINKEDIN_COOKIE}`,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            },
            timeout: 10000,
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });

        return { valid: true, message: 'LinkedIn session is active' };
    } catch (error) {
        if (error.response?.status === 302 && error.response?.headers?.location?.includes('/login')) {
            return { valid: false, error: 'LinkedIn session expired' };
        }
        return { valid: false, error: error.message };
    }
}
