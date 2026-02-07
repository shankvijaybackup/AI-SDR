import OpenAI from 'openai';
import prisma from '../lib/prisma.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    },

    /**
     * Generate LinkedIn Headline
     */
    async generateHeadline(role, industry, tone = "Professional") {
        const prompt = `
      Generate 5 LinkedIn headlines for a ${role} in ${industry}.
      Tone: ${tone}
      
      Rules:
      - Under 220 characters
      - Focus on value/results/impact
      - No buzzwords like "Passionate" or "Guru"
      
      Return JSON: { "headlines": ["headline 1", "headline 2"...] }
    `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    },

    /**
     * Generate Sales Navigator Filters from natural language
     */
    async generateSalesNavFilters(query) {
        const prompt = `
      Convert this natural language search request into LinkedIn Sales Navigator filters.
      Request: "${query}"
      
      Return JSON:
      {
        "jobTitles": [],
        "industries": [],
        "companySize": [],
        "keywords": [],
        "geography": []
      }
    `;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    },

    /**
     * Generate Icebreaker for a profile
     */
    async generateIcebreaker(profileUrl, quickContext = "") {
        // Ideally we'd scrape the profile here. For now, we generate based on the URL or simulated context.
        const prompt = `
      Write 3 icebreakers for a LinkedIn message to someone with this profile: ${profileUrl}.
      Context/Recent Activity Snippet: "${quickContext}"
      
      Rules:
      - Casual but professional
      - Under 30 words
      - Reference the context if provided
      
      Return JSON: { "icebreakers": ["option 1", "option 2", "option 3"] }
    `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0].message.content);
    }
};
