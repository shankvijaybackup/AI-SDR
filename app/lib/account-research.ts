
/**
 * Account Research Service (Gemini + Google Search Grounding)
 * 
 * Performs "Deep Research" on accounts by using Gemini's built-in Google Search tool.
 */

import { prisma } from './prisma';
import { generateContentSafe, GeminiRequestOptions } from './gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';

// We use a specific function to access the search tool capabilities
async function generateWithSearch(prompt: string, apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use gemini-flash-latest first (stable, high limits).
    // Then 2.0-flash (often rate limited).
    // Then 2.0-exp.

    const strategies = ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'];

    for (const modelName of strategies) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                tools: [{ googleSearch: {} } as any] // Enable Grounding (Cast to any to avoid old typing issues)
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return {
                text: response.text(),
                groundingMetadata: response.candidates?.[0]?.groundingMetadata
            };
        } catch (e: any) {
            console.warn(`[Deep Research] Failed with ${modelName} (Search): ${e.message}`);
            // Continue to next model
        }
    }

    // Fallback to standard safe generation (no grounding tool, just internal knowledge)
    console.warn('[Deep Research] Fallback to internal knowledge (no search tool)');
    const res = await generateContentSafe(prompt);
    return { text: res.response.text(), groundingMetadata: null };
}

export async function performDeepResearch(accountId: string, userId: string) {
    console.log(`[Deep Research] Starting for Account ID: ${accountId}`);

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new Error("Account not found");

    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("No API Key found");

    // 1. Research Prompt
    const prompt = `
    Perform deep, context-aware market research on the company "${account.name}".
    Domain: ${account.domain || 'Unknown'}
    Industry: ${account.industry || 'Unknown'}
    location: ${account.location || 'Unknown'}

    Goal: Find specific, recent, and actionable intelligence relevant to a sales team.
    
    Tasks:
    1. Find recent news (last 6 months) - layoffs, funding, hiring, new products.
    2. Identify 3 key challenges they might be facing based on their industry trends.
    3. Find their tech stack if possible (only if publicly visible).
    
    Output Format:
    Return a JSON array of objects. Each object must have:
    - title: Headline of the finding
    - source: Full valid URL (e.g. "https://techcrunch.com/2024/01/01/startup-raises-series-b/") or "Internal Analysis"
    - content: Summary of the finding (2-3 sentences)
    - tags: Array of strings (e.g. ["Funding", "Risk", "Hiring"])
    - relevanceScore: Number 1-10
    
    IMPORTANT: 
    1. Do NOT truncate URLs. Provide the full, clickable link.
    2. Do NOT use "vertexaisearch.cloud.google.com" or "grounding-api-redirect" links. You must extract and use the ORIGINAL publisher URL (e.g., bloomberg.com, techcrunch.com) from your search results.
    
    Example:
    [
        { "title": "Raised Series B", "source": "https://techcrunch.com/2024/01/01/startup-raises-series-b", "content": "...", "tags": ["Funding"], "relevanceScore": 10 }
    ]
    
    Return ONLY VALID JSON.
    `;

    try {
        const { text: textResponse, groundingMetadata } = await generateWithSearch(prompt, apiKey);

        let researchNotes: any[] = [];
        try {
            // Robust JSON extraction: Find the first '[' and last ']'
            const start = textResponse.indexOf('[');
            const end = textResponse.lastIndexOf(']');

            if (start === -1 || end === -1) {
                throw new Error('No JSON array found in response');
            }

            const jsonStr = textResponse.substring(start, end + 1);
            researchNotes = JSON.parse(jsonStr);
        } catch (e) {
            console.error('[Deep Research] Failed to parse JSON:', textResponse);
            return [];
        }

        if (!Array.isArray(researchNotes)) return [];

        // Extract valid URLs from metadata chunks as a fallback pool
        const validUrls: string[] = [];
        if (groundingMetadata?.groundingChunks) {
            groundingMetadata.groundingChunks.forEach((chunk: any) => {
                if (chunk.web?.uri && !chunk.web.uri.includes('vertexaisearch')) {
                    validUrls.push(chunk.web.uri);
                }
            });
        }

        console.log(`[Deep Research] Found ${validUrls.length} valid grounding URLs.`);

        const notesToCreate = researchNotes.map((note, index) => {
            let cleanSource = note.source || 'Gemini Research';

            // Fix junk links
            if (cleanSource.includes('vertexaisearch') || cleanSource.includes('google.com/grounding')) {
                // Heuristic 1: If we have a valid URL at the same index? (Unlikely to match but possible if linear)
                // Heuristic 2: Just pick the first valid URL?
                // Heuristic 3: Leave as "Google Search" if we really can't find one.

                if (validUrls.length > 0) {
                    // Just pick the i-th one if available, cycling through? 
                    // Or just the first one to be safe. 
                    // Better to give a general valid link than a broken redirect.
                    cleanSource = validUrls[index % validUrls.length];
                } else {
                    cleanSource = "Google Search (Link Internal)";
                }
            }

            return {
                accountId: account.id,
                source: cleanSource,
                title: note.title || 'Research Finding',
                content: note.content || '',
                url: cleanSource.startsWith('http') ? cleanSource : undefined,
                tags: note.tags || [],
                relevanceScore: note.relevanceScore || 5
            };
        });

        console.log(`[Deep Research] Saving ${notesToCreate.length} notes...`);

        // Use createMany
        await prisma.researchNote.createMany({
            data: notesToCreate
        });

        return notesToCreate;

    } catch (e: any) {
        console.error('[Deep Research] Error:', e);
        return [];
    }
}
