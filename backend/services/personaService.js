import axios from "axios";
import * as cheerio from "cheerio";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

// Initialize AI Clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

        // Remove noise
        $('script, style, noscript, header, footer, nav, iframe, svg').remove();

        // Extract main text, keeping more content
        let text = $('body').text().replace(/\s+/g, ' ').trim();
        console.log(`[Persona] Scraped ${text.length} characters from website.`);
        return text.substring(0, 15000); // Keep more context (15k chars)
    } catch (err) {
        console.error(`[Persona] Scrape failed for ${url}:`, err.message);
        return null;
    }
}

// ============ 2. PERPLEXITY: Deep Research (User's Exact Prompt) ============
async function researchCompanyWithPerplexity(companyName, websiteUrl) {
    if (!PERPLEXITY_API_KEY) {
        console.warn("[Persona] No Perplexity Key, skipping live research.");
        return "Perplexity research unavailable (Missing API Key). Proceeding with other sources.";
    }

    // User's exact prompt style
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
                model: "sonar", // Current valid Perplexity model
                messages: [
                    { role: "system", content: "You are an expert business researcher and analyst. Provide thorough, well-structured research with specific facts, names, and numbers." },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: 4000 // Allow longer response
            },
            {
                headers: {
                    "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 60000 // 60 second timeout for deep research
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

// ============ 3. GEMINI: Deep Website Analysis ============
async function analyzeContentWithGemini(scrapedText, companyName) {
    if (!scrapedText || scrapedText.length < 200) {
        return "Website content too short for meaningful analysis.";
    }

    if (!process.env.GEMINI_API_KEY) {
        console.warn("[Persona] No Gemini Key, skipping content analysis.");
        return "Gemini analysis unavailable (Missing API Key).";
    }

    try {
        console.log(`[Persona] Calling Gemini for content analysis on ${companyName}...`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log(`[Persona] Gemini returned ${text.length} characters.`);
        return text;
    } catch (err) {
        console.error("[Persona] Gemini failed:", err.message);
        return `Gemini analysis failed: ${err.message}`;
    }
}

// ============ 4. OPENAI: Synthesize into Rich Structured JSON ============
async function synthesizePersona(companyName, websiteUrl, scrapedData, perplexityData, geminiData, existingKnowledge) {
    try {
        console.log(`[Persona] Calling OpenAI for synthesis...`);

        const systemPrompt = `You are a Senior Market Researcher tasked with synthesizing multiple research sources into a comprehensive Company Research Report.

Your output must be a well-structured JSON object that matches the quality of professional market research. Be specific with names, numbers, and facts. Do not use placeholders like "[Name not provided]" - if information is unavailable, state "Not found in sources" or infer from context.`;

        const userPrompt = `Target Company: "${companyName}"
Website: ${websiteUrl}

=== SOURCE 1: PERPLEXITY DEEP RESEARCH ===
${perplexityData}

=== SOURCE 2: GEMINI WEBSITE ANALYSIS ===
${geminiData}

=== SOURCE 3: RAW WEBSITE EXCERPT ===
${scrapedData ? scrapedData.substring(0, 3000) : "Not available"}

${existingKnowledge ? `=== SOURCE 4: EXISTING KNOWLEDGE BASE (Internal Documents) ===
${existingKnowledge}

` : ''}
---

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
    "key_features": ["Feature 1", "Feature 2", "..."],
    "integrations": ["Slack", "Teams", "etc."],
    "differentiators": ["What makes them unique vs competitors"],
    "themes": ["Theme1", "Theme2", "...up to 10 key product themes/keywords"],
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
    "industries": ["Tech", "Healthcare", "etc."],
    "buyer_personas": [
      { 
        "title": "CIO", 
        "pain_points": ["Pain 1", "Pain 2"], 
        "goals": ["Goal 1", "Goal 2"],
        "challenges": ["What this role struggles with today"],
        "outreach_angles": ["Best way to approach this persona", "What resonates with them"]
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
    "primary_themes": ["Top 5 themes/keywords that define this company"],
    "keywords": ["10-15 searchable keywords for matching"],
    "value_propositions": ["3-5 core value props"],
    "target_industries": ["Industries they serve"],
    "problems_solved": ["Top 3-5 problems this company solves"]
  }
}

Return ONLY valid JSON. Be comprehensive and specific.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Using GPT-4o for best synthesis
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4000
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log(`[Persona] OpenAI synthesis complete.`);
        return result;
    } catch (err) {
        console.error("[Persona] OpenAI synthesis failed:", err.message);
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

    // Step 1 & 2: Parallel execution for data gathering
    const [scrapedText, perplexityResult] = await Promise.all([
        scrapeCompanyWebsite(url),
        researchCompanyWithPerplexity(companyName, url)
    ]);

    // Step 3: Gemini analysis (depends on scraped text)
    const geminiResult = await analyzeContentWithGemini(scrapedText, companyName);

    // Step 4: Final Synthesis with all data INCLUDING existing knowledge
    const persona = await synthesizePersona(companyName, url, scrapedText, perplexityResult, geminiResult, existingKnowledge);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[Persona] COMPLETE in ${duration}s`);
    console.log(`========================================\n`);

    return persona;
}
