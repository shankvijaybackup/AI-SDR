import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load knowledge base
let knowledgeBase = null;

function loadKnowledgeBase() {
  if (knowledgeBase) return knowledgeBase;
  
  try {
    const kbPath = path.join(__dirname, '../knowledge/atomicwork-kb.json');
    const data = fs.readFileSync(kbPath, 'utf8');
    knowledgeBase = JSON.parse(data);
    console.log('[RAG] Knowledge base loaded successfully');
    return knowledgeBase;
  } catch (error) {
    console.error('[RAG] Failed to load knowledge base:', error);
    return null;
  }
}

/**
 * Objection pattern matchers - maps user phrases to KB objection categories
 */
const OBJECTION_PATTERNS = {
  "We already use ServiceNow/Jira/Freshservice": [
    /servicenow/i, /jira/i, /freshservice/i, /zendesk/i, /bmc/i, /remedy/i,
    /already (use|have|using)/i, /we('re| are) (on|using)/i, /works fine/i,
    /our standard/i, /just bought/i, /current (tool|system)/i
  ],
  "How is this different from a chatbot?": [
    /chatbot/i, /chat bot/i, /bot/i, /different from/i, /just another/i,
    /tried (chatbots?|bots?)/i, /chatbots? (don't|never|didn't) work/i,
    /useless/i, /gimmick/i
  ],
  "We're not ready for AI yet": [
    /not ready for ai/i, /ai (is|seems) (too )?risky/i, /not mature enough/i,
    /not looking at ai/i, /ai is (overhyped|hype)/i, /skeptical about ai/i,
    /don't trust ai/i, /ai never works/i, /isn't mature enough/i,
    /org isn't mature/i, /organization isn't ready/i
  ],
  "What about security and compliance?": [
    /security/i, /compliance/i, /soc ?2/i, /gdpr/i, /hipaa/i, /privacy/i,
    /data (privacy|protection)/i, /audit/i, /regulated/i, /top concern/i
  ],
  "This sounds expensive": [
    /expensive/i, /cost/i, /budget/i, /price|pricing/i, /how much/i,
    /cutting costs/i, /no budget/i, /next fiscal/i, /afford/i, /too much money/i
  ],
  "We don't have the resources to implement this": [
    /no (resources|bandwidth)/i, /too busy/i, /stretched (too )?thin/i,
    /can't take on/i, /don't have (time|bandwidth|resources)/i,
    /team is busy/i, /no capacity/i, /overwhelmed/i
  ],
  "Our employees won't adopt it": [
    /won't adopt/i, /adoption/i, /people don't like change/i,
    /nobody uses/i, /no one uses/i, /users won't/i, /change management/i,
    /won't use (another|new)/i
  ],
  "What if it gives wrong answers?": [
    /wrong answers/i, /accurate|accuracy/i, /hallucin/i, /trust.*ai/i,
    /ai makes mistakes/i, /reliable/i, /can we trust/i, /incorrect/i
  ],
  "We need to see a demo first": [
    /demo/i, /see it (first|in action)/i, /show me/i, /evaluate/i,
    /need to see/i, /let me see/i, /before deciding/i
  ],
  "We're in the middle of other projects": [
    /other projects/i, /bad timing/i, /next quarter/i, /call.*(back|later)/i,
    /lot going on/i, /other priorities/i, /6 months/i, /busy (right now|period)/i,
    /not (a good|the right) time/i
  ]
};

/**
 * Find relevant objection handling from knowledge base
 */
export function findObjectionResponse(userText) {
  const kb = loadKnowledgeBase();
  if (!kb) return null;

  const lowerText = userText.toLowerCase();
  
  // First try pattern matching for better coverage
  for (const [objectionKey, patterns] of Object.entries(OBJECTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(userText)) {
        // Find matching KB entry
        const kbObj = kb.objections_and_responses.find(o => 
          o.objection.toLowerCase().includes(objectionKey.toLowerCase().split('/')[0].substring(0, 20))
        );
        if (kbObj) {
          return {
            objection: kbObj.objection,
            response: kbObj.response,
            followUp: kbObj.follow_up
          };
        }
      }
    }
  }
  
  // Fallback: keyword matching
  for (const obj of kb.objections_and_responses) {
    const objectionLower = obj.objection.toLowerCase();
    const keywords = objectionLower.split(' ').filter(w => w.length > 3);
    const matchCount = keywords.filter(kw => lowerText.includes(kw)).length;
    
    if (matchCount >= 2 || lowerText.includes(objectionLower)) {
      return {
        objection: obj.objection,
        response: obj.response,
        followUp: obj.follow_up
      };
    }
  }
  
  return null;
}

/**
 * Get relevant context for a question using semantic search
 */
export async function getRelevantContext(question, conversationPhase) {
  const kb = loadKnowledgeBase();
  if (!kb) return null;

  try {
    // Build context chunks from knowledge base
    const chunks = [];
    
    // Add product features
    kb.features.forEach(feature => {
      chunks.push({
        type: 'feature',
        content: `${feature.name}: ${feature.description}. Benefits: ${feature.benefits.join(', ')}`,
        source: feature.name
      });
    });
    
    // Add objection responses
    kb.objections_and_responses.forEach(obj => {
      chunks.push({
        type: 'objection',
        content: `Q: ${obj.objection}\nA: ${obj.response}`,
        source: 'objection_handling'
      });
    });
    
    // Add customer stories
    kb.customer_stories.forEach(story => {
      chunks.push({
        type: 'case_study',
        content: `${story.company} - Challenge: ${story.challenge}. Results: ${story.results.join(', ')}`,
        source: 'customer_stories'
      });
    });
    
    // Add competitive advantages
    chunks.push({
      type: 'differentiators',
      content: `Key differentiators: ${kb.competitive_advantages.join(', ')}`,
      source: 'competitive_advantages'
    });
    
    // Simple keyword-based retrieval (can be enhanced with embeddings)
    const questionLower = question.toLowerCase();
    const relevantChunks = chunks.filter(chunk => {
      const contentLower = chunk.content.toLowerCase();
      const questionWords = questionLower.split(' ').filter(w => w.length > 3);
      return questionWords.some(word => contentLower.includes(word));
    }).slice(0, 3); // Top 3 most relevant
    
    if (relevantChunks.length === 0) {
      // Return general context based on phase
      if (conversationPhase === 'pitch') {
        return {
          context: kb.product_overview.description + ' ' + kb.product_overview.key_differentiator,
          sources: ['product_overview']
        };
      }
      return null;
    }
    
    return {
      context: relevantChunks.map(c => c.content).join('\n\n'),
      sources: relevantChunks.map(c => c.source)
    };
  } catch (error) {
    console.error('[RAG] Context retrieval error:', error);
    return null;
  }
}

/**
 * Enhanced RAG with embeddings (for future implementation)
 */
export async function getRelevantContextWithEmbeddings(question) {
  try {
    // Generate embedding for the question
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    
    // In production, you'd:
    // 1. Store KB chunks with embeddings in a vector DB (Pinecone, Weaviate, etc.)
    // 2. Query vector DB with question embedding
    // 3. Return top K most similar chunks
    
    // For now, fall back to keyword search
    return await getRelevantContext(question, 'discovery');
  } catch (error) {
    console.error('[RAG] Embedding error:', error);
    return await getRelevantContext(question, 'discovery');
  }
}

/**
 * Get company info for basic questions
 */
export function getCompanyInfo(question) {
  const kb = loadKnowledgeBase();
  if (!kb) return null;
  
  // Handle undefined or null question
  if (!question) {
    return `Atomicwork is an AI-native ITSM and ESM platform. We help IT teams modernize service management with AI agents that work in Slack and Teams.`;
  }

  const lowerQ = question.toLowerCase();
  
  // Location queries
  if (lowerQ.includes('headquarter') || lowerQ.includes('location') || lowerQ.includes('where are you') || 
      lowerQ.includes('where is') || lowerQ.includes('based') || lowerQ.includes('office')) {
    return `We're headquartered in ${kb.company.headquarters}, with an office in ${kb.company.offices[1]}.`;
  }
  
  // Founded queries
  if (lowerQ.includes('founded') || lowerQ.includes('how old') || lowerQ.includes('when start')) {
    return `Atomicwork was founded in ${kb.company.founded}.`;
  }
  
  // Team size queries
  if (lowerQ.includes('team size') || lowerQ.includes('how many people') || lowerQ.includes('how big') || 
      lowerQ.includes('employees') || lowerQ.includes('size of')) {
    return `We're a ${kb.company.team_size} team, headquartered in San Francisco with an office in Bangalore.`;
  }
  
  // Funding queries
  if (lowerQ.includes('funding') || lowerQ.includes('funded') || lowerQ.includes('investor')) {
    return `We're ${kb.company.funding}.`;
  }
  
  // Integration queries
  if (lowerQ.includes('integrate') || lowerQ.includes('integration') || lowerQ.includes('connect') ||
      lowerQ.includes('work with') || lowerQ.includes('support')) {
    return `We integrate with ${kb.integrations.slice(0, 8).join(', ')}, and many more. Our platform connects with your existing tools seamlessly.`;
  }
  
  // Pricing queries
  if (lowerQ.includes('pricing') || lowerQ.includes('cost') || lowerQ.includes('price') || lowerQ.includes('how much')) {
    return `Our pricing starts at ${kb.pricing.starting_price}, and we offer a ${kb.pricing.free_trial}. Most customers see ROI in under 6 months.`;
  }
  
  // Default response for general "what do they do" or "tell me about" questions
  if (lowerQ.includes('what do') || lowerQ.includes('tell me about') || lowerQ.includes('what does') || 
      lowerQ.includes('never heard') || lowerQ.includes('who are you') || lowerQ.includes('what is atomicwork') ||
      lowerQ.includes('atomicwork')) {
    return `Atomicwork is a Series A funded AI-native service management platform founded in 2022. We're based in San Francisco with offices in Bangalore. We help IT teams modernize service management with our Universal AI Agent called Atom. It works directly in Slack, Teams, and email - eliminating portal fatigue. Our customers typically see $200K+ in annual savings and achieve 40-60% ticket deflection. Think of us as bringing your entire IT service desk into the tools your employees already use daily.`;
  }
  
  return null;
}

/**
 * Get relevant customer story
 */
export function getCustomerStory(context) {
  const kb = loadKnowledgeBase();
  if (!kb || !kb.customer_stories.length) return null;
  
  // Simple selection - can be enhanced with context matching
  const story = kb.customer_stories[0];
  return `For example, ${story.company} had a similar challenge - ${story.challenge}. After implementing Atomicwork, they ${story.results[0].toLowerCase()}.`;
}

export default {
  findObjectionResponse,
  getRelevantContext,
  getCompanyInfo,
  getCustomerStory,
  loadKnowledgeBase
};
