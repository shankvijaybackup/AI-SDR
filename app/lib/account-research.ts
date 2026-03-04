
/**
 * Account Research Service
 *
 * Uses Tavily (primary) → Exa (fallback) for real-time web search,
 * then Claude Sonnet to synthesize findings into structured research notes.
 *
 * This replaces the old Gemini + Google Search grounding approach.
 */

import { prisma } from './prisma';
import { generateJSON } from './claude';

// ─── Tavily Search ─────────────────────────────────────────────────────────────
async function searchWithTavily(query: string): Promise<string> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return '';

    try {
        const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query,
                search_depth: 'advanced',
                include_answer: true,
                max_results: 8,
            }),
        });
        if (!res.ok) throw new Error(`Tavily ${res.status}`);
        const data = await res.json();

        const answer = data.answer ? `Summary: ${data.answer}\n\n` : '';
        const results = (data.results || [])
            .map((r: any) => `[${r.title}] (${r.url})\n${r.content}`)
            .join('\n\n');
        return answer + results;
    } catch (err: any) {
        console.warn('[Research] Tavily failed:', err.message);
        return '';
    }
}

// ─── Exa Search ────────────────────────────────────────────────────────────────
async function searchWithExa(query: string): Promise<string> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return '';

    try {
        const res = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify({
                query,
                num_results: 8,
                use_autoprompt: true,
                type: 'neural',
                contents: { text: { max_characters: 1000 } },
            }),
        });
        if (!res.ok) throw new Error(`Exa ${res.status}`);
        const data = await res.json();

        return (data.results || [])
            .map((r: any) => `[${r.title}] (${r.url})\n${r.text || r.snippet || ''}`)
            .join('\n\n');
    } catch (err: any) {
        console.warn('[Research] Exa failed:', err.message);
        return '';
    }
}

// ─── Main: Deep Research ────────────────────────────────────────────────────────
export async function performDeepResearch(accountId: string, userId: string) {
    console.log(`[Deep Research] Starting for Account ID: ${accountId}`);

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new Error('Account not found');

    const companyQuery = `${account.name} company news funding hiring 2024 2025`;
    const techQuery = `${account.name} ${account.domain || ''} technology stack engineering`;

    // 1. Gather live web context (Tavily primary, Exa fallback)
    let webContext = await searchWithTavily(companyQuery);
    if (!webContext) {
        console.log('[Research] Tavily unavailable — trying Exa...');
        webContext = await searchWithExa(companyQuery);
    }

    let techContext = await searchWithTavily(techQuery);
    if (!techContext) techContext = await searchWithExa(techQuery);

    const hasLiveData = !!(webContext || techContext);
    const contextSection = hasLiveData
        ? `\n\nLive Web Intelligence:\n${webContext}\n\nTech Stack Research:\n${techContext}`
        : '\n\nNote: No live web search available. Use training knowledge only.';

    // 2. Claude synthesises the raw web data into structured findings
    const prompt = `You are an expert B2B sales intelligence analyst.

Company: ${account.name}
Domain: ${account.domain || 'Unknown'}
Industry: ${account.industry || 'Unknown'}
Location: ${account.location || 'Unknown'}
${contextSection}

Based on the above, generate 5–7 structured research findings a sales team can act on immediately.

Return a VALID JSON ARRAY (no markdown, no code block). Each object must have:
- title: string — concise headline
- source: string — URL if from web results, or "Training Knowledge" if not
- content: string — 2–3 sentences with specific, actionable detail
- tags: string[] — e.g. ["Funding", "Hiring", "Risk", "Tech Stack", "News"]
- relevanceScore: number 1–10`;

    try {
        const notes = await generateJSON<Array<{
            title: string
            source: string
            content: string
            tags: string[]
            relevanceScore: number
        }>>(prompt, {
            model: 'sonnet',
            maxTokens: 2500,
            temperature: 0.4,
        });

        if (!Array.isArray(notes)) return [];

        const notesToCreate = notes.map((note) => ({
            accountId: account.id,
            source: note.source || (hasLiveData ? 'Web Research' : 'Claude Research'),
            title: note.title || 'Research Finding',
            content: note.content || '',
            url: note.source?.startsWith('http') ? note.source : undefined,
            tags: note.tags || [],
            relevanceScore: note.relevanceScore || 5,
        }));

        console.log(`[Deep Research] Saving ${notesToCreate.length} notes (live=${hasLiveData})...`);

        await prisma.researchNote.createMany({ data: notesToCreate });
        return notesToCreate;

    } catch (e: any) {
        console.error('[Deep Research] Error:', e);
        return [];
    }
}
