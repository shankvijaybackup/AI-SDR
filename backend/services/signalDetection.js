import axios from 'axios';
import prisma from '../lib/prisma.js';


// Use existing Google Search Config
const GOOGLE_API_KEY = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_AI_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_SEARCH_CX;

/**
 * Signal Detection Service
 * Detects intent signals from various sources using Google Search as a proxy
 * to avoid expensive specialized APIs for Reddit/LinkedIn/Twitter.
 */
export const SignalDetectionService = {

    /**
     * Detect signals for an Account
     * @param {string} accountId 
     */
    async detectForAccount(accountId) {
        const account = await prisma.account.findUnique({
            where: { id: accountId }
        });

        if (!account) throw new Error("Account not found");

        const signals = [];
        const companyName = account.name;
        const competitors = (account.enrichmentData?.competitors || []).map(c => c.name);

        console.log(`[SignalDetection] Scanning for ${companyName}...`);

        // 1. Reddit: Competitor Alternatives
        if (competitors.length > 0) {
            for (const competitor of competitors.slice(0, 3)) {
                const redditSignals = await this.searchRedditForCompetitor(competitor, companyName);
                signals.push(...redditSignals);
            }
        }

        // 2. LinkedIn: Hiring Signals (Growth)
        const hiringSignals = await this.searchLinkedInHiring(companyName);
        signals.push(...hiringSignals);

        // 3. News: Funding / Expansion
        const newsSignals = await this.searchNews(companyName);
        signals.push(...newsSignals);

        // Save signals to DB
        for (const signal of signals) {
            await prisma.intentSignal.create({
                data: {
                    accountId,
                    type: signal.type,
                    source: signal.source,
                    content: signal.content,
                    url: signal.url,
                    score: signal.score,
                    metadata: signal.metadata
                }
            });
        }

        return signals;
    },

    /**
     * Search Reddit for posts looking for alternatives to competitors
     */
    async searchRedditForCompetitor(competitor, myCompany) {
        if (!GOOGLE_API_KEY || !GOOGLE_CX) return [];

        const query = `site:reddit.com "alternative to ${competitor}" OR "better than ${competitor}"`;
        const results = await this.googleSearch(query);

        return results.map(item => ({
            type: 'competitor_alternatives',
            source: 'reddit',
            content: item.title + ": " + item.snippet,
            url: item.link,
            score: 8, // High intent
            metadata: { competitor }
        }));
    },

    /**
     * Search LinkedIn for hiring posts indicating growth in relevant roles
     */
    async searchLinkedInHiring(companyName) {
        if (!GOOGLE_API_KEY || !GOOGLE_CX) return [];

        const query = `site:linkedin.com/jobs "${companyName}" (SDR OR "Sales Development" OR "Account Executive")`;
        const results = await this.googleSearch(query);

        if (results.length > 0) {
            return results.map(item => ({
                type: 'hiring_growth',
                source: 'linkedin',
                content: `Hiring detected: ${item.title}`,
                url: item.link,
                score: 6,
                metadata: { role: 'Sales' }
            }));
        }
        return [];
    },

    /**
     * Search News/Press for recent funding or launches
     */
    async searchNews(companyName) {
        if (!GOOGLE_API_KEY || !GOOGLE_CX) return [];

        const query = `"${companyName}" (funding OR "series A" OR "series B" OR acquisition)`;
        const results = await this.googleSearch(query);

        return results.map(item => ({
            type: 'company_news',
            source: 'news',
            content: item.title,
            url: item.link,
            score: 5,
            metadata: { topic: 'growth' }
        }));
    },

    /**
     * Detect signals for a specific Lead (Personalized)
     */
    async detectForLead(leadId) {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return [];

        // Search for lead's recent activity (posts, comments)
        // This is harder without direct API, but we can try site:linkedin.com/in/user/recent-activity
        // For MVP, skipping explicit lead-level scraping to stay safe.
        return [];
    },

    // --- Helper ---
    async googleSearch(query) {
        try {
            const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=3`;
            const res = await axios.get(url);
            return res.data.items || [];
        } catch (err) {
            console.error("[SignalDetection] Search failed:", err.message);
            return [];
        }
    }
};
