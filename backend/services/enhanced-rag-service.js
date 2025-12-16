import OpenAI from 'openai';
import { findObjectionResponse, getCompanyInfo, getCustomerStory } from './rag-service.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Detect pain points from prospect's response
 */
function detectPainPoints(text) {
  const painPatterns = {
    manual_processes: [
      /manual/i,
      /tedious/i,
      /time.?consuming/i,
      /repetitive/i,
      /takes forever/i,
      /forever/i,
      /too long/i,
      /by hand/i,
      /access request/i
    ],
    high_ticket_volume: [
      /ticket/i,
      /volume/i,
      /overwhelmed/i,
      /backlog/i,
      /drowning/i,
      /killing us/i,
      /swamped/i
    ],
    slow_response: [
      /slow/i,
      /delay/i,
      /waiting/i,
      /SLA/i,
      /response time/i,
      /terrible/i,
      /missed/i
    ],
    tool_sprawl: [
      /multiple.*system/i,
      /too many tools/i,
      /nothing integrated/i,
      /fragmented/i,
      /siloed/i
    ],
    low_adoption: [
      /no one uses/i,
      /nobody uses/i,
      /portal/i,
      /hate/i,
      /adoption/i,
      /won't use/i
    ],
    compliance: [
      /compliance/i,
      /audit/i,
      /nightmare/i,
      /mess/i,
      /governance/i,
      /SOC/i,
      /HIPAA/i
    ],
    legacy_systems: [
      /outdated/i,
      /legacy/i,
      /old jira/i,
      /stuck on/i,
      /ServiceNow is/i,
      /Jira is/i
    ]
  };
  
  const detected = [];
  for (const [pain, patterns] of Object.entries(painPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        detected.push(pain);
        break; // Only add once per pain category
      }
    }
  }
  return detected;
}

/**
 * Get agentic capability talking points based on detected pain
 */
function getAgenticTalkingPoints(painPoints) {
  const talkingPoints = {
    manual_processes: "Agentic AI can handle multi-step workflows autonomously—like provisioning access across 5 systems with one Slack message. No forms, no approvals chain, just done.",
    high_ticket_volume: "Agentic models don't just deflect tickets—they actually resolve them. They reason through problems, take action, and close the loop without human intervention.",
    slow_response: "Agentic AI responds instantly and can even fix issues proactively—before users notice them. Imagine VPN issues getting resolved before the user even calls.",
    tool_sprawl: "Agentic AI orchestrates across all your systems in one conversation. User asks for access? It checks AD, provisions in Okta, updates ServiceNow, and confirms in Slack—all automatically.",
    low_adoption: "The beauty of agentic AI is it meets employees where they work—Slack, Teams, email. No portals, no forms, just natural conversation. Adoption happens naturally.",
    compliance: "Agentic models are inherently context-aware—they check permissions against your policies, log every action for audit trails, and ensure compliance automatically.",
    legacy_systems: "Agentic AI can sit on top of your existing systems and orchestrate them. You don't have to rip and replace—it enhances what you already have."
  };
  
  if (painPoints.length === 0) return null;
  
  return painPoints.map(p => talkingPoints[p]).filter(Boolean).join('\n\n');
}

/**
 * Enhanced RAG with uploaded knowledge sources
 * This integrates with the database to retrieve user-uploaded documents
 */
export async function getEnhancedContext(question, userId, conversationPhase) {
  try {
    // 0. Detect pain points and get relevant agentic talking points
    const painPoints = detectPainPoints(question);
    console.log(`[Enhanced RAG] Detected pain points: ${painPoints.join(', ') || 'none'}`);
    
    // 1. Check static knowledge base first (objections, company info)
    const objection = findObjectionResponse(question);
    if (objection) {
      return {
        type: 'objection',
        content: `${objection.response}\n\n${objection.followUp}`,
        source: 'static_kb',
        painPoints, // Always include detected pain points
        confidence: 'high'
      };
    }

    const companyInfo = getCompanyInfo(question);
    if (companyInfo) {
      return {
        type: 'company_info',
        content: companyInfo,
        source: 'static_kb',
        painPoints, // Always include detected pain points
        confidence: 'high'
      };
    }

    // 2. Search uploaded knowledge sources with semantic search
    const uploadedContext = await searchUploadedKnowledge(question, userId);
    
    // 3. Get agentic talking points if pain points detected
    const agenticPoints = getAgenticTalkingPoints(painPoints);
    
    // Combine uploaded context with agentic talking points
    if (uploadedContext && agenticPoints) {
      return {
        type: 'combined_context',
        content: `${uploadedContext.content}\n\n**AGENTIC AI TALKING POINTS (based on their pain):**\n${agenticPoints}`,
        sources: uploadedContext.sources,
        painPoints,
        confidence: 'high'
      };
    }
    
    if (uploadedContext) {
      return {
        ...uploadedContext,
        painPoints // Always include detected pain points
      };
    }
    
    if (agenticPoints) {
      return {
        type: 'agentic_context',
        content: `**AGENTIC AI TALKING POINTS (based on their pain):**\n${agenticPoints}`,
        source: 'pain_detection',
        painPoints,
        confidence: 'medium'
      };
    }

    // 4. Fallback to customer stories
    const story = getCustomerStory(question);
    if (story) {
      return {
        type: 'customer_story',
        content: story,
        source: 'static_kb',
        confidence: 'medium'
      };
    }

    return null;
  } catch (error) {
    console.error('[Enhanced RAG] Error:', error);
    return null;
  }
}

/**
 * Search uploaded knowledge sources using embeddings
 * Calls the Next.js API endpoint for semantic search
 */
async function searchUploadedKnowledge(question, userId) {
  try {
    const NEXT_APP_URL = process.env.NEXT_APP_URL || 'http://localhost:3000';
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
    const response = await fetch(
      `${NEXT_APP_URL}/api/knowledge/search?q=${encodeURIComponent(question)}&limit=2`,
      {
        headers: {
          'x-user-id': userId,
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[Enhanced RAG] Search API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const topChunks = data.results;
      
      // Truncate content for voice (keep it short)
      const truncatedContent = topChunks.map(c => c.text.substring(0, 200)).join('\n');
      
      return {
        type: 'uploaded_knowledge',
        content: truncatedContent,
        sources: [...new Set(topChunks.map(c => c.sourceTitle))],
        confidence: topChunks[0].similarity > 0.5 ? 'high' : 'medium',
        metadata: {
          searchedSources: data.searchedSources,
          topSimilarity: topChunks[0].similarity
        }
      };
    }

    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[Enhanced RAG] Search timed out');
    } else {
      console.error('[Enhanced RAG] Search error:', error.message);
    }
    return null;
  }
}

/**
 * Generate embedding for a question
 */
async function generateQuestionEmbedding(question) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('[Embeddings] Error:', error);
    throw error;
  }
}

/**
 * Find similar chunks using cosine similarity
 */
function findSimilarChunks(queryEmbedding, chunks, topK = 3) {
  const similarities = chunks.map(chunk => ({
    text: chunk.text,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    metadata: chunk.metadata
  }));
  
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Calculate cosine similarity
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
}

export default {
  getEnhancedContext,
  searchUploadedKnowledge,
  generateQuestionEmbedding
};
