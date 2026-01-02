
/**
 * Account Research Service (TypeScript Version for Next.js App)
 * 
 * Performs "Deep Research" on accounts by intersecting:
 * 1. Prospect Identity
 * 2. Seller's Value Props (Knowledge Base)
 */

import { prisma } from './prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Mock Search Service - In production, replace with Perplexity/Exa/Brave
async function searchWeb(query: string) {
    console.log(`[Search API] Searching for: "${query}"`);
    // Placeholder
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate finding results based on keywords
    if (query.toLowerCase().includes('marketing') && query.toLowerCase().includes('clearwing')) {
        return [
            {
                title: "Clearwing Productions hiring Marketing Coordinator",
                url: "https://clearwing.com/careers/marketing",
                content: "We are looking for a Marketing Coordinator to unify our email campaigns and manage our CRM data...",
                publishedDate: "2024-01-15"
            }
        ];
    }

    if (query.toLowerCase().includes('security') || query.toLowerCase().includes('compliance')) {
        return [
            {
                title: "New Data Protection Regulations Announced",
                url: "https://example.com/news/gdpr-update",
                content: "Companies in the sector are facing increased scrutiny over data privacy...",
                publishedDate: "2024-02-10"
            }
        ];
    }

    return [
        {
            title: `Recent news about ${query}`,
            url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
            content: `General info found about ${query}...`,
            publishedDate: new Date().toISOString()
        }
    ];
}

export async function performDeepResearch(accountId: string, userId: string) {
    console.log(`[Deep Research] Starting for Account ID: ${accountId}`);

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new Error("Account not found");

    // 1. Fetch User's Knowledge Themes
    const knowledgeSources = await prisma.knowledgeSource.findMany({
        where: { userId: userId, isActive: true },
        select: { title: true, tags: true, category: true }
    });

    const sellerThemes = new Set<string>();
    knowledgeSources.forEach(src => {
        if (src.tags) src.tags.forEach(t => sellerThemes.add(t));
        if (src.category) sellerThemes.add(src.category);
    });

    if (sellerThemes.size === 0) {
        sellerThemes.add('growth');
        sellerThemes.add('efficiency');
    }

    const themesList = Array.from(sellerThemes).slice(0, 3);
    console.log(`[Deep Research] Seller Themes: ${themesList.join(', ')}`);

    // 2. Formulate Contextual Queries
    const queries: string[] = [];
    themesList.forEach(theme => {
        queries.push(`${account.name} "${theme}" challenges`);
        queries.push(`${account.name} "${theme}" stack`);
    });
    queries.push(`${account.name} hiring "VP" or "Director"`);

    // 3. Execute Searches
    const researchNotes = [];

    for (const query of queries) {
        try {
            const results = await searchWeb(query);

            for (const result of results) {
                // 4. Analyze Relevance with LLM
                const completion = await openai.chat.completions.create({
                    messages: [
                        { role: "system", content: "You are a research analyst." },
                        {
                            role: "user", content: `
                            I am selling a solution related to: ${themesList.join(', ')}.
                            I found this news about my prospect ${account.name}:
                            Title: ${result.title}
                            Content: ${result.content}
                            
                            Is this relevant? Format: VALID|Score(1-10)|Summary
                            If strictly irrelevant, return: INVALID
                        `}
                    ],
                    model: "gpt-4-turbo-preview", // or 3.5-turbo
                });

                const content = completion.choices[0].message.content || 'INVALID';

                if (content.includes('VALID')) {
                    const parts = content.split('|');
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

    // 5. Store in DB
    if (researchNotes.length > 0) {
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
