import axios from "axios";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";

// Initialize AI Clients
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// ============ 1. SCRAPE: Fetch raw text from the URL ============
async function scrapeCompanyWebsite(url) {
    try {
        console.log(`[Persona] Scraping ${url}...`);
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            timeout: 15000
        });
        const $ = cheerio.load(data);

        $('script, style, noscript, header, footer, nav, iframe, svg').remove();

        let text = $('body').text().replace(/\s+/g, ' ').trim();
        console.log(`[Persona] Scraped ${text.length} characters from website.`);
        return text.substring(0, 15000);
    } catch (err) {
        console.error(`[Persona] Scrape failed for ${url}:`, err.message);
        return null;
    }
}

// ============ 2. TAVILY: Real-time Web Search (supplementary) ============
async function researchWithTavily(companyName, websiteUrl) {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    const EXA_API_KEY = process.env.EXA_API_KEY;

    const query = `${companyName} company overview founders product funding ICP 2024 2025`;

    // Try Tavily first
    if (TAVILY_API_KEY) {
        try {
            console.log(`[Persona] Calling Tavily for web research on ${companyName}...`);
            const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: TAVILY_API_KEY,
                    query,
                    search_depth: 'advanced',
                    include_answer: true,
                    max_results: 10,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const answer = data.answer ? `Summary: ${data.answer}\n\n` : '';
                const results = (data.results || [])
                    .map(r => `[${r.title}] (${r.url})\n${r.content}`)
                    .join('\n\n');
                const combined = answer + results;
                if (combined.trim()) {
                    console.log(`[Persona] Tavily returned ${combined.length} characters.`);
                    return combined;
                }
            }
        } catch (err) {
            console.warn('[Persona] Tavily failed:', err.message);
        }
    }

    // Fallback to Exa
    if (EXA_API_KEY) {
        try {
            console.log(`[Persona] Falling back to Exa for ${companyName}...`);
            const response = await fetch('https://api.exa.ai/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': EXA_API_KEY },
                body: JSON.stringify({
                    query,
                    num_results: 10,
                    use_autoprompt: true,
                    type: 'neural',
                    contents: { text: { max_characters: 1200 } },
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const results = (data.results || [])
                    .map(r => `[${r.title}] (${r.url})\n${r.text || r.snippet || ''}`)
                    .join('\n\n');
                if (results.trim()) {
                    console.log(`[Persona] Exa returned ${results.length} characters.`);
                    return results;
                }
            }
        } catch (err) {
            console.warn('[Persona] Exa failed:', err.message);
        }
    }

    console.warn('[Persona] No Tavily/Exa keys configured, skipping web search.');
    return '';
}

// ============ 3. PERPLEXITY: Deep Research (keep — not OpenAI/Gemini) ============
async function researchCompanyWithPerplexity(companyName, websiteUrl) {
    if (!PERPLEXITY_API_KEY) {
        console.warn("[Persona] No Perplexity Key, skipping live research.");
        return "Perplexity research unavailable (Missing API Key). Proceeding with other sources.";
    }

    const userPrompt = `Here is Company Name: "${companyName}" & Its website: ${websiteUrl}

You are a Researcher. Do a thorough Deep research about this company, read all its blogs, contents and build a full 360 about this company:

1. **Who they are**: Company overview, headquarters, offices, funding history.
2. **Who are their founders**: Names, backgrounds, past companies, their credibility.
3. **Why they built this company**: The origin story, the problem they observed, their mission.
4. **What product they build**: Core platform, key features, integrations, how it works.
5. **How the market perceives their product**: Customer results, testimonials, market positioning vs competitors.
6. **Build an ICP**: Who is their target audience? Company size, industry, buyer personas, who should buy their product.

Be comprehensive and cite sources where possible.`;

    try {
        console.log(`[Persona] Calling Perplexity for deep research on ${companyName}...`);
        const response = await axios.post(
            "https://api.perplexity.ai/chat/completions",
            {
                model: "sonar",
                messages: [
                    { role: "system", content: "You are an expert business researcher and analyst. Provide thorough, well-structured research with specific facts, names, and numbers." },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: 4000
            },
            {
                headers: {
                    "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 60000
            }
        );
        const result = response.data.choices[0].message.content;
        console.log(`[Persona] Perplexity returned ${result.length} characters.`);
        return result;
    } catch (err) {
        console.error("[Persona] Perplexity failed:", err.response?.data || err.message);
        return `Perplexity research failed: ${err.message}`;
    }
}

// ============ 4. CLAUDE: Deep Website Analysis (replaces Gemini) ============
async function analyzeContentWithClaude(scrapedText, companyName) {
    if (!scrapedText || scrapedText.length < 200) {
        return "Website content too short for meaningful analysis.";
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn("[Persona] No Anthropic Key, skipping content analysis.");
        return "Claude analysis unavailable (Missing API Key).";
    }

    try {
        console.log(`[Persona] Calling Claude for content analysis on ${companyName}...`);

        const prompt = `You are a Researcher analyzing ${companyName}'s website content.

Build a comprehensive 360-view analysis including:

1. **Company Identity**: What they do, their positioning, company description.
2. **Product & Features**: Core offerings, key capabilities, how their product works.
3. **Value Proposition**: Why customers should choose them, key differentiators.
4. **Target Audience (ICP)**: Who their ideal customer is based on messaging and use cases.
5. **Brand Voice & Tone**: How they communicate (professional, casual, innovative, etc.).
6. **Key Claims & Proof Points**: Customer results, statistics, or testimonials mentioned.

Website Content:
${scrapedText.substring(0, 12000)}`;

        const message = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            temperature: 0.3,
            messages: [{ role: "user", content: prompt }]
        });

        const text = message.content[0].text;
        console.log(`[Persona] Claude returned ${text.length} characters.`);
        return text;
    } catch (err) {
        console.error("[Persona] Claude analysis failed:", err.message);
        return `Claude analysis failed: ${err.message}`;
    }
}

// ============ 5. CLAUDE: Synthesize into Rich Structured JSON (replaces OpenAI GPT-4o) ============
async function synthesizePersona(companyName, websiteUrl, scrapedData, perplexityData, tavilyData, claudeData, existingKnowledge) {
    try {
        console.log(`[Persona] Calling Claude Sonnet for synthesis...`);

        const systemPrompt = `You are a Senior Market Researcher tasked with synthesizing multiple research sources into a comprehensive Company Research Report.

Your output must be a well-structured JSON object that matches the quality of professional market research. Be specific with names, numbers, and facts. Do not use placeholders like "[Name not provided]" - if information is unavailable, state "Not found in sources" or infer from context.

Reply ONLY with valid JSON.`;

        const userPrompt = `Target Company: "${companyName}"
Website: ${websiteUrl}

=== SOURCE 1: PERPLEXITY DEEP RESEARCH ===
${perplexityData}

=== SOURCE 2: TAVILY/EXA REAL-TIME WEB SEARCH ===
${tavilyData || 'Not available (no Tavily/Exa key)'}

=== SOURCE 3: CLAUDE WEBSITE ANALYSIS ===
${claudeData}

=== SOURCE 4: RAW WEBSITE EXCERPT ===
${scrapedData ? scrapedData.substring(0, 3000) : "Not available"}

${existingKnowledge ? `=== SOURCE 5: EXISTING KNOWLEDGE BASE (Internal Documents) ===
${existingKnowledge}

` : ''}---

Synthesize ALL sources above into a comprehensive JSON research report with this EXACT structure:

{
  "company_overview": {
    "name": "...",
    "tagline": "...",
    "description": "2-3 sentence summary",
    "headquarters": "...",
    "other_offices": ["..."],
    "founded": "year",
    "funding": { "total": "...", "latest_round": "...", "investors": ["..."] }
  },
  "founders": {
    "profiles": [
      { "name": "...", "role": "...", "background": "...", "previous_companies": ["..."] }
    ],
    "collective_credibility": "Why this team is credible",
    "origin_story": "Why they founded this company, the problem they observed"
  },
  "product": {
    "name": "Product name if different from company",
    "category": "e.g., ITSM, ESM, AI Platform",
    "core_offering": "Main product in 1-2 sentences",
    "key_features": ["Feature 1", "Feature 2"],
    "integrations": ["Slack", "Teams"],
    "differentiators": ["What makes them unique vs competitors"],
    "themes": ["Theme1", "Theme2"],
    "use_cases": [
      { "title": "Use case name", "description": "What problem it solves", "target_role": "Who benefits most" }
    ]
  },
  "market_position": {
    "perception": "How the market sees them",
    "customer_results": ["Specific metrics or testimonials"],
    "competitors": ["Competitor 1", "Competitor 2"],
    "competitive_advantage": "Why they win against competitors"
  },
  "icp": {
    "company_size": "e.g., 500-10,000 employees",
    "industries": ["Tech", "Healthcare"],
    "buyer_personas": [
      {
        "title": "CIO",
        "pain_points": ["Pain 1", "Pain 2"],
        "goals": ["Goal 1", "Goal 2"],
        "challenges": ["What this role struggles with today"],
        "outreach_angles": ["Best way to approach this persona"]
      }
    ],
    "ideal_customer_description": "1-2 sentence summary of perfect fit customer",
    "disqualifiers": "Who should NOT buy this"
  },
  "brand_voice": {
    "tone": "Professional, Innovative, etc.",
    "key_messages": ["Message 1", "Message 2"],
    "communication_style": "How they talk to customers"
  },
  "themes_summary": {
    "primary_themes": ["Top 5 themes that define this company"],
    "keywords": ["10-15 searchable keywords"],
    "value_propositions": ["3-5 core value props"],
    "target_industries": ["Industries they serve"],
    "problems_solved": ["Top 3-5 problems this company solves"]
  }
}

Return ONLY valid JSON. Be comprehensive and specific.`;

        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4000,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }]
        });

        const content = message.content[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
        console.log(`[Persona] Claude Sonnet synthesis complete.`);
        return result;
    } catch (err) {
        console.error("[Persona] Claude synthesis failed:", err.message);
        throw err;
    }
}

// ============ MAIN ORCHESTRATOR ============
export async function generateCompanyPersona(url, companyName, existingKnowledge = null) {
    console.log(`\n========================================`);
    console.log(`[Persona] STARTING DEEP RESEARCH: ${companyName}`);
    console.log(`[Persona] URL: ${url}`);
    if (existingKnowledge) {
        console.log(`[Persona] Including ${existingKnowledge.length} chars of existing knowledge from KB`);
    }
    console.log(`========================================\n`);

    const startTime = Date.now();

    // Step 1, 2 & 3: Parallel execution for all data gathering sources
    const [scrapedText, perplexityResult, tavilyResult] = await Promise.all([
        scrapeCompanyWebsite(url),
        researchCompanyWithPerplexity(companyName, url),
        researchWithTavily(companyName, url),
    ]);

    // Step 4: Claude analysis of scraped website content
    const claudeAnalysis = await analyzeContentWithClaude(scrapedText, companyName);

    // Step 5: Final Synthesis with all data sources INCLUDING existing knowledge
    const persona = await synthesizePersona(companyName, url, scrapedText, perplexityResult, tavilyResult, claudeAnalysis, existingKnowledge);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[Persona] COMPLETE in ${duration}s`);
    console.log(`========================================\n`);

    return persona;
}
