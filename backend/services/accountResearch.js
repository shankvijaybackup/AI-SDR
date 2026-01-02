
/**
 * Account Research Service
 * 
 * Performs "Deep Research" on accounts by intersecting:
 * 1. Prospect Identity (Who they are)
 * 2. Seller's Value Props (What we sell) - derived from Knowledge Base
 * 
 * Uses Search APIs (e.g. Perplexity/Exa/Google) to find relevant news/signals.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getAiResponse } = require('../openaiClient');

// Mock Search Service - In production, replace with Perplexity/Exa API client
async function searchWeb(query) {
    console.log(`[Search API] Searching for: "${query}"`);
    // Placeholder for actual API call
    // In a real implementation:
    // const results = await exa.search(query);
    // return results;

    // Simulate finding results for demonstration
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate latency

    // Return mock results tailored to query type for testing
    if (query.includes('marketing') && query.includes('Clearwing')) {
        return [
            {
                title: "Clearwing Productions hiring Marketing Coordinator",
                url: "https://clearwing.com/careers/marketing",
                content: "We are looking for a Marketing Coordinator to unify our email campaigns and manage our CRM data...",
                publishedDate: "2024-01-15"
            }
        ];
    }

    // Default generic result
    return [
        {
            title: `Recent news about ${query}`,
            url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
            content: `Mock content finding relevant info about ${query}. This company is expanding its operations...`,
            publishedDate: new Date().toISOString()
        }
    ];
}

/**
 * Perform Deep Context-Aware Research
 * @param {string} accountId 
 * @param {string} userId - To fetch relevant knowledge themes
 */
async function performDeepResearch(accountId, userId) {
    console.log(`[Deep Research] Starting for Account ID: ${accountId}`);

    // 1. Fetch Account & User Themes
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new Error("Account not found");

    // Fetch User's Knowledge Themes (simplified: just fetching titles/tags)
    const knowledgeSources = await prisma.knowledgeSource.findMany({
        where: { userId: userId, isActive: true },
        select: { title: true, tags: true, category: true }
    });

    // Extract Key Themes from Knowledge Base
    // e.g. "CRM", "Sales Automation", "SOC2", "Remote Hiring"
    const sellerThemes = new Set();
    knowledgeSources.forEach(src => {
        if (src.tags) src.tags.forEach(t => sellerThemes.add(t));
        // Add title keywords if relevant (simplified)
        sellerThemes.add(src.category);
    });

    // Add default themes if none found (fallback)
    if (sellerThemes.size === 0) {
        sellerThemes.add('growth');
        sellerThemes.add('efficiency');
    }

    const themesList = Array.from(sellerThemes).slice(0, 3); // Top 3 themes to focus on
    console.log(`[Deep Research] Seller Themes: ${themesList.join(', ')}`);

    // 2. Formulate Contextual Queries
    const queries = [];

    // A. Intersection Queries (Prospect + Theme)
    themesList.forEach(theme => {
        queries.push(`${account.name} "${theme}" challenges`);
        queries.push(`${account.name} "${theme}" stack`);
        // e.g. "Clearwing 'CRM' challenges"
    });

    // B. Strategic Signals (Hiring, Expansion)
    queries.push(`${account.name} hiring "VP" or "Director"`);
    queries.push(`${account.name} earnings call transcripts summary`);

    // 3. Execute Searches & Synthesize
    const researchNotes = [];

    for (const query of queries) {
        try {
            const results = await searchWeb(query);

            for (const result of results) {
                // 4. Analyze Relevance with LLM (Synthesize)
                // We use a lightweight check or just process top results

                const prompt = `
                I am selling a solution related to: ${themesList.join(', ')}.
                I found this news about my prospect ${account.name}:
                Title: ${result.title}
                Content: ${result.content}
                
                Is this relevant to my solution?
                If yes, summarize the insight in 1 sentence and provide a relevance score (1-10).
                Format: VALID|Score|Summary
                If no, return: INVALID
                `;

                const aiAnalysis = await getAiResponse(prompt, 'gpt-4o-mini'); // Use cheaper model

                if (aiAnalysis.includes('VALID')) {
                    const parts = aiAnalysis.split('|');
                    const score = parseInt(parts[1]) || 5;
                    const summary = parts[2] || result.title;

                    researchNotes.push({
                        accountId: account.id,
                        source: 'web_search',
                        url: result.url,
                        title: result.title,
                        content: summary,
                        tags: [themesList.find(t => query.includes(t)) || 'general'],
                        relevanceScore: score
                    });
                }
            }
        } catch (e) {
            console.error(`[Deep Research] Error searching for ${query}:`, e);
        }
    }

    // 5. Store Notes in DB
    if (researchNotes.length > 0) {
        // Deduplicate based on title/url to avoid spam
        const uniqueNotes = researchNotes.filter((note, index, self) =>
            index === self.findIndex((t) => (
                t.url === note.url
            ))
        );

        console.log(`[Deep Research] Saving ${uniqueNotes.length} notes...`);

        await prisma.researchNote.createMany({
            data: uniqueNotes
        });

        return uniqueNotes;
    }

    return [];
}

module.exports = { performDeepResearch };
