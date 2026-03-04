import Anthropic from '@anthropic-ai/sdk';
import prisma from '../lib/prisma.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function claudeJSON(system, prompt, model = 'claude-haiku-4-5-20251001', maxTokens = 800) {
    const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: 0.7,
        system: system + ' Reply ONLY with valid JSON.',
        messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].text;
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return JSON.parse(match ? match[0] : text);
}

export const ContentGeneratorService = {

    /**
     * Analyze an outreach message and provide a score (1-10) and feedback
     */
    async analyzeMessage(message, persona = "SDR targeting B2B Founders") {
        if (!message) throw new Error("Message is required");

        const prompt = `
      You are an expert Sales Copywriter. Analyze the following cold outreach message.
      Target Audience: ${persona}
      
      Message:
      "${message}"
      
      Provide a response in JSON format:
      {
        "score": number (1-10),
        "summary": "1 sentence summary",
        "strengths": ["point 1", "point 2"],
        "weaknesses": ["point 1", "point 2"],
        "improvements": "Rewrite the message to be better (keep it under 100 words)"
      }
      
      Critique strictly:
      - 1-3: Spammy, generic
      - 4-6: Average, boring
      - 7-9: Good, personalized
      - 10: Perfect
    `;

        return claudeJSON(
            'You are an expert Sales Copywriter who scores and improves cold outreach messages.',
            prompt,
            'claude-sonnet-4-6'
        );
    },

    /**
     * Generate LinkedIn Headline
     */
    async generateHeadline(role, industry, tone = "Professional") {
        return claudeJSON(
            'You are a LinkedIn profile expert.',
            `Generate 5 LinkedIn headlines for a ${role} in ${industry}. Tone: ${tone}. Under 220 chars each. No buzzwords.
Return JSON: { "headlines": ["headline 1", "headline 2", "headline 3", "headline 4", "headline 5"] }`
        );
    },

    /**
     * Generate Sales Navigator Filters from natural language
     */
    async generateSalesNavFilters(query) {
        return claudeJSON(
            'You are a LinkedIn Sales Navigator expert.',
            `Convert this to Sales Navigator filters: "${query}"
Return JSON: { "jobTitles": [], "industries": [], "companySize": [], "keywords": [], "geography": [] }`
        );
    },

    /**
     * Generate Icebreaker for a profile
     */
    async generateIcebreaker(profileUrl, quickContext = "") {
        return claudeJSON(
            'You are a sales outreach expert specialising in personalised icebreakers.',
            `Write 3 icebreakers for a LinkedIn message to this profile: ${profileUrl}.
Context: "${quickContext}". Rules: casual but professional, under 30 words, reference context if provided.
Return JSON: { "icebreakers": ["option 1", "option 2", "option 3"] }`
        );
    }
};
