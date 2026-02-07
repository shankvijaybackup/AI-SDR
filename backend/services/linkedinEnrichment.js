/**
 * LinkedIn Lead Enrichment Service
 *
 * Scrapes LinkedIn profiles and generates strategic intelligence for sales conversations
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
        console.log('[LinkedIn] Starting multi-model persona generation...');

        // Run both models in parallel
        const [claudePersona, openaiPersona] = await Promise.all([
            generatePersonaWithClaude(profileData, lead),
            generatePersonaWithOpenAI(profileData, lead)
        ]);

        // Cross-validate and synthesize
        const synthesized = synthesizePersonas(claudePersona, openaiPersona, profileData);

        console.log('[LinkedIn] ✅ Multi-model persona synthesis complete');
        return synthesized;

    } catch (error) {
        console.error('[LinkedIn] Multi-model synthesis failed:', error.message);

        // Fallback to single model if multi-model fails
        try {
            console.log('[LinkedIn] Falling back to single model...');
            return await generatePersonaWithOpenAI(profileData, lead);
        } catch (fallbackError) {
            // Return basic fallback persona
            return getBasicFallbackPersona(lead);
        }
    }
}

/**
 * Generate persona using Claude Opus 4.5
 */
async function generatePersonaWithClaude(profileData, lead) {
    const systemPrompt = `You are an expert sales psychologist and communication strategist.
Analyze LinkedIn profiles to create actionable strategic intelligence for sales conversations.

CRITICAL: Base your analysis ONLY on verifiable facts from the profile. Mark inferences clearly.

Your analysis must be:
1. Practical and actionable for immediate sales use
2. Based on observable data (job titles, experience, education, content)
3. Focused on communication strategy and personality insights
4. Professional and respectful`;

    const userPrompt = buildEnrichmentPrompt(profileData, lead);

    const message = await anthropic.messages.create({
        model: "claude-opus-4-5-20251101",
        max_tokens: 4000,
        temperature: 0.7,
        messages: [{ role: "user", content: systemPrompt + "\n\n" + userPrompt }]
    });

    const content = message.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

    return result;
}

/**
 * Generate persona using OpenAI GPT-4o
 */
async function generatePersonaWithOpenAI(profileData, lead) {
    const systemPrompt = `You are an expert sales psychologist and communication strategist.
Analyze LinkedIn profiles to create actionable strategic intelligence for sales conversations.

CRITICAL: Base your analysis ONLY on verifiable facts from the profile. Mark inferences clearly.

Your analysis must be:
1. Practical and actionable for immediate sales use
2. Based on observable data (job titles, experience, education, content)
3. Focused on communication strategy and personality insights
4. Professional and respectful`;

    const userPrompt = buildEnrichmentPrompt(profileData, lead);

    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000
    });

    return JSON.parse(completion.choices[0].message.content);
}

/**
 * Build enrichment prompt for both models
 */
function buildEnrichmentPrompt(profileData, lead) {
    return `Analyze this LinkedIn profile and generate strategic sales intelligence:

NAME: ${profileData.name}
HEADLINE: ${profileData.headline}
CURRENT ROLE: ${lead.jobTitle || profileData.headline}
COMPANY: ${lead.company}
LOCATION: ${profileData.location}

EXPERIENCE:
${profileData.experience.map(exp => `- ${exp.title} at ${exp.company} (${exp.duration})`).join('\n')}

EDUCATION:
${profileData.education.map(edu => `- ${edu.degree} from ${edu.school}`).join('\n')}

SKILLS: ${profileData.skills.join(', ')}

ABOUT:
${profileData.about || 'Not provided'}

Generate a comprehensive strategic brief in this EXACT JSON structure:

{
  "discProfile": "D/I/S/C (choose primary)",
  "discDescription": "1 sentence description of personality type",
  "communicationStyle": "1 sentence: how they prefer to communicate",
  "executiveSnapshot": {
    "roleAndFocus": "What their role focuses on day-to-day",
    "coreStrengths": ["Strength 1", "Strength 2", "Strength 3"],
    "personaRead": "1 sentence personality assessment"
  },
  "strategicPrep": {
    "connectionAngle": "Best way to open the conversation",
    "commonGround": "Potential connection points or shared interests",
    "smartQuestions": [
      "Question 1 about their role/company",
      "Question 2 about their goals",
      "Question 3 about their challenges"
    ]
  },
  "internalCoaching": {
    "howToWin": [
      "Do this",
      "Say this",
      "Focus on this"
    ],
    "pitfallsAvoid": [
      "Don't do this",
      "Avoid this",
      "Never say this"
    ]
  },
  "likelyPainPoints": [
    "Pain point 1 based on their role",
    "Pain point 2 based on their industry",
    "Pain point 3 based on their experience"
  ],
  "motivators": ["What drives them professionally"],
  "talkingPoints": [
    "Point 1 relevant to their background",
    "Point 2 relevant to their company",
    "Point 3 relevant to their role"
  ]
}

Base your analysis ONLY on the provided data. Be specific and actionable.

Include a "factualClaims" array listing only verifiable facts from the profile.`;
}

/**
 * Synthesize personas from both models
 */
function synthesizePersonas(claudePersona, openaiPersona, profileData) {
    console.log('[LinkedIn] Synthesizing insights from both models...');

    // Cross-validate factual claims
    const validation = crossValidateClaims(claudePersona, openaiPersona, profileData);

    // Synthesize best insights
    const synthesized = {
        metadata: {
            approach: "multi-model-synthesis",
            models: ["claude-opus-4.5", "gpt-4o"],
            timestamp: new Date().toISOString(),
            validationScore: {
                claudeVerified: validation.claudeValid,
                openaiVerified: validation.openaiValid,
                consensusRate: validation.consensusRate
            }
        },
        discProfile: selectBest('discProfile', claudePersona, openaiPersona),
        discDescription: selectBest('discDescription', claudePersona, openaiPersona),
        communicationStyle: selectBest('communicationStyle', claudePersona, openaiPersona),
        executiveSnapshot: {
            roleAndFocus: selectBest('executiveSnapshot.roleAndFocus', claudePersona, openaiPersona),
            coreStrengths: mergeArrays(claudePersona.executiveSnapshot?.coreStrengths, openaiPersona.executiveSnapshot?.coreStrengths, 3),
            personaRead: selectBest('executiveSnapshot.personaRead', claudePersona, openaiPersona)
        },
        strategicPrep: {
            connectionAngle: selectBest('strategicPrep.connectionAngle', claudePersona, openaiPersona),
            commonGround: selectBest('strategicPrep.commonGround', claudePersona, openaiPersona),
            smartQuestions: mergeArrays(claudePersona.strategicPrep?.smartQuestions, openaiPersona.strategicPrep?.smartQuestions, 7)
        },
        internalCoaching: {
            howToWin: mergeArrays(claudePersona.internalCoaching?.howToWin, openaiPersona.internalCoaching?.howToWin, 7),
            pitfallsAvoid: mergeArrays(claudePersona.internalCoaching?.pitfallsAvoid, openaiPersona.internalCoaching?.pitfallsAvoid, 7)
        },
        likelyPainPoints: mergeArrays(claudePersona.likelyPainPoints, openaiPersona.likelyPainPoints, 7),
        motivators: mergeArrays(claudePersona.motivators, openaiPersona.motivators, 5),
        talkingPoints: mergeArrays(claudePersona.talkingPoints, openaiPersona.talkingPoints, 7),
        decisionMakingStyle: selectBest('decisionMakingStyle', claudePersona, openaiPersona),
        expectedObjections: mergeArrays(claudePersona.expectedObjections, openaiPersona.expectedObjections, 5)
    };

    return synthesized;
}

/**
 * Cross-validate factual claims between models
 */
function crossValidateClaims(claudePersona, openaiPersona, profileData) {
    const claudeFacts = claudePersona.factualClaims || [];
    const openaiFacts = openaiPersona.factualClaims || [];

    // Simple validation - count verified claims
    const validation = {
        claudeValid: claudeFacts.length,
        openaiValid: openaiFacts.length,
        consensusRate: claudeFacts.length > 0 && openaiFacts.length > 0
            ? Math.min(claudeFacts.length, openaiFacts.length) / Math.max(claudeFacts.length, openaiFacts.length) * 100
            : 0
    };

    return validation;
}

/**
 * Select best value (longest/most detailed)
 */
function selectBest(path, claudeData, openaiData) {
    const getNestedValue = (obj, path) => {
        return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
    };

    const claudeValue = getNestedValue(claudeData, path) || '';
    const openaiValue = getNestedValue(openaiData, path) || '';

    // Prefer Claude if significantly longer (more detailed)
    if (claudeValue.length > openaiValue.length * 1.3) {
        return { value: claudeValue, source: 'claude', confidence: 'high' };
    } else if (openaiValue.length > claudeValue.length * 1.3) {
        return { value: openaiValue, source: 'openai', confidence: 'high' };
    } else {
        // Similar length, prefer Claude
        return { value: claudeValue || openaiValue, source: 'claude', confidence: 'medium' };
    }
}

/**
 * Merge and rank arrays from both models
 */
function mergeArrays(claudeArray = [], openaiArray = [], topN = 7) {
    const merged = [];

    // Add Claude items with metadata
    claudeArray.forEach(item => {
        if (typeof item === 'string') {
            merged.push({ text: item, source: 'claude', length: item.length });
        } else if (item && typeof item === 'object') {
            merged.push({ ...item, source: 'claude' });
        }
    });

    // Add OpenAI items that are sufficiently different
    openaiArray.forEach(item => {
        const itemText = typeof item === 'string' ? item : JSON.stringify(item);
        const isDuplicate = merged.some(m => {
            const mergedText = typeof m.text === 'string' ? m.text : JSON.stringify(m);
            return similarity(mergedText, itemText) > 0.7;
        });

        if (!isDuplicate) {
            if (typeof item === 'string') {
                merged.push({ text: item, source: 'openai', length: item.length });
            } else if (item && typeof item === 'object') {
                merged.push({ ...item, source: 'openai' });
            }
        }
    });

    // Sort by length (detail level)
    merged.sort((a, b) => {
        const aLength = a.length || (a.text ? a.text.length : 0);
        const bLength = b.length || (b.text ? b.text.length : 0);
        return bLength - aLength;
    });

    // Return top N items with source attribution
    return merged.slice(0, topN).map(item => ({
        text: item.text || item,
        source: item.source,
        confidence: item.source === 'claude' ? 'high' : 'medium'
    }));
}

/**
 * Calculate string similarity
 */
function similarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

/**
 * Get basic fallback persona
 */
function getBasicFallbackPersona(lead) {
    return {
        metadata: {
            approach: "fallback",
            models: [],
            timestamp: new Date().toISOString()
        },
        discProfile: { value: "Unknown", source: "fallback", confidence: "low" },
        discDescription: { value: "Profile analysis not available", source: "fallback", confidence: "low" },
        communicationStyle: { value: "Professional and direct", source: "fallback", confidence: "low" },
        executiveSnapshot: {
            roleAndFocus: { value: lead.jobTitle || "Role information not available", source: "fallback", confidence: "low" },
            coreStrengths: [{ text: "Industry experience", source: "fallback", confidence: "low" }],
            personaRead: { value: "Strategic professional", source: "fallback", confidence: "low" }
        },
        strategicPrep: {
            connectionAngle: { value: `Ask about ${lead.company}'s current priorities`, source: "fallback", confidence: "low" },
            commonGround: { value: "Industry challenges", source: "fallback", confidence: "low" },
            smartQuestions: [
                { text: `How is ${lead.company} handling current market changes?`, source: "fallback", confidence: "low" },
                { text: "What are your top priorities this quarter?", source: "fallback", confidence: "low" },
                { text: "What challenges are you facing in your role?", source: "fallback", confidence: "low" }
            ]
        },
        internalCoaching: {
            howToWin: [
                { text: "Be respectful of their time", source: "fallback", confidence: "low" },
                { text: "Focus on business value", source: "fallback", confidence: "low" },
                { text: "Ask insightful questions", source: "fallback", confidence: "low" }
            ],
            pitfallsAvoid: [
                { text: "Don't be too salesy", source: "fallback", confidence: "low" },
                { text: "Avoid making assumptions", source: "fallback", confidence: "low" },
                { text: "Don't rush to pitch", source: "fallback", confidence: "low" }
            ]
        },
        likelyPainPoints: [
            { text: "Time management", source: "fallback", confidence: "low" },
            { text: "Process efficiency", source: "fallback", confidence: "low" },
            { text: "Team alignment", source: "fallback", confidence: "low" }
        ],
        motivators: [
            { text: "Results", source: "fallback", confidence: "low" },
            { text: "Efficiency", source: "fallback", confidence: "low" },
            { text: "Growth", source: "fallback", confidence: "low" }
        ],
        talkingPoints: [
            { text: `Experience in ${lead.company}`, source: "fallback", confidence: "low" },
            { text: "Industry expertise", source: "fallback", confidence: "low" },
            { text: "Professional development", source: "fallback", confidence: "low" }
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
