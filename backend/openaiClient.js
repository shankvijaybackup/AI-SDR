// backend/openaiClient.js
import OpenAI from "openai";
import { 
  findObjectionResponse, 
  getRelevantContext, 
  getCompanyInfo,
  getCustomerStory 
} from "./services/rag-service.js";
import { getEnhancedContext } from "./services/enhanced-rag-service.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Infer the current conversation phase from transcript + latestUserText
 * Phases:
 * - rapport: first turn, being human and asking permission
 * - discovery: understanding tools, pain points (2-3 questions max)
 * - pitch: map to Atomicwork + propose next step
 * - email_capture: collect contact info, stop pitching
 */
function inferPhase({ transcript, latestUserText }) {
  const turnCount = transcript.length;
  const text = latestUserText.toLowerCase();

  // Check if permission was granted
  const permissionGranted = transcript.some(t => 
    t.speaker === 'prospect' && 
    /yes|sure|yeah|go ahead|good time|let'?s talk|sounds good/i.test(t.text)
  );

  // Count how many discovery questions have been asked
  const discoveryQuestions = transcript.filter(t => 
    t.speaker === 'agent' && 
    /what tools|how do you|how'?s|where do employees|what's your biggest|how are employees|tell me about/i.test(t.text)
  ).length;

  // Check if we've done consultative education (ITIL V4, agentic AI, industry trends)
  const hasEducated = transcript.some(t =>
    t.speaker === 'agent' &&
    /itil|agentic ai|meeting employees where they are|slack.*teams|industry trend|other it leaders/i.test(t.text)
  );

  // CLOSING: After email is captured and confirmed, end gracefully
  const emailCaptured = transcript.some(t => 
    t.speaker === 'agent' && 
    /what'?s your email|email address|spelled|reach out.*monday|send.*confirmation/i.test(t.text)
  );

  // If the agent is already trying to verify/collect email, stay in email capture
  const agentAskedForEmail = transcript.some(t =>
    t.speaker === 'agent' &&
    /best email|your email|email to reach|have your email as/i.test(t.text)
  );

  // If the prospect has agreed to a meeting/demo, move into email capture next
  const meetingAgreed =
    /let'?s meet|meet next week|schedule|book|demo|send.*times|tuesday|wednesday|thursday|friday|monday/i.test(text) ||
    transcript.some(t =>
      t.speaker === 'prospect' &&
      /let'?s meet|meet next week|schedule|book|demo|send.*times/i.test(t.text)
    );
  
  const emailConfirmed = transcript.some(t =>
    t.speaker === 'prospect' &&
    /sure|sounds good|yeah|okay|right|thank you|thanks/i.test(t.text)
  );

  // If email was asked for AND confirmed, move to closing
  if (emailCaptured && emailConfirmed && turnCount >= 8) {
    return "closing";
  }

  // If meeting is agreed or agent asked for email, switch to email capture (before parsing email text)
  if (meetingAgreed && turnCount >= 6) {
    return "email_capture";
  }
  if (agentAskedForEmail) {
    return "email_capture";
  }

  // EMAIL CAPTURE: If they're giving email or contact info
  if (
    /my email|email is|email address|it'?s [a-z]+@|it'?s [a-z]+ at/i.test(text) ||
    /reach out.*email|send.*email|here'?s my email/i.test(text) ||
    /^[a-z0-9@._-]+@[a-z0-9.-]+$/i.test(text.trim()) || // actual email format
    (turnCount >= 5 && /^[a-z]+ at [a-z]+/i.test(text)) // "DJ at atomic clock"
  ) {
    return "email_capture";
  }

  // PITCH: Only if they EXPLICITLY agree to demo/meeting AND we've educated them first
  // Don't treat neutral responses like "oh okay" as buying signals
  if (discoveryQuestions >= 2 && hasEducated) {
    if (
      /yes.*demo|sure.*demo|sounds good.*demo|let'?s do.*demo/i.test(text) ||
      /worth exploring|interested|tell me more|let'?s catch up|send.*info/i.test(text) ||
      /next week.*meet|schedule.*demo|book.*time/i.test(text)
    ) {
      return "pitch";
    }
  }

  // RAPPORT: Stay in rapport until permission is granted
  if (turnCount <= 1 || !permissionGranted) {
    return "rapport";
  }

  // DISCOVERY: After permission granted, ask 2-3 questions (turns 2-5)
  if (permissionGranted && turnCount >= 2 && turnCount <= 5) {
    return "discovery";
  }

  // CONSULTATIVE: After discovery, educate before pitching (turns 6-7)
  if (discoveryQuestions >= 2 && !hasEducated && turnCount >= 6) {
    return "consultative";
  }

  // PITCH: After consultative education or if explicit interest
  if (turnCount >= 8 || (discoveryQuestions >= 3 && hasEducated)) {
    return "pitch";
  }

  // Default: DISCOVERY
  return "discovery";
}

/**
 * Build the system prompt with explicit behaviour rules.
 * Now supports custom scripts passed from the database.
 */
function buildSystemPrompt(phase, customScript = null) {
  // If custom script provided, use it; otherwise fall back to Atomicwork default
  const basePersona = customScript 
    ? `You are a friendly, emotionally intelligent SDR making an outbound sales call.

Your script/talking points:
${customScript}

Use this script as your guide, but adapt naturally to the conversation. Don't read it verbatim - be conversational and human.`
    : `You are Alex, a friendly, emotionally intelligent SDR for **Atomicwork**.

Atomicwork is an **AI-native service management platform** with a Universal AI Agent.
Headquarters: San Francisco, California (with offices in Bangalore, India).`;

  // Only include Atomicwork-specific details if using default persona
  const productDetails = !customScript ? `

**Core Value Propositions:**
- **Universal AI Agent (Atom)**: Meets employees in Slack/Teams with voice, chat, and screen-sharing support. Zero-touch resolutions for IT, HR, Finance requests.
- **Identity & Access Management (IGA)**: Automate access provisioning, deprovisioning, and governance. Saves 1500+ IT hours/year on manual access requests.
- **Digital Workplace Experience**: Eliminate portal fatigue. Employees get help where they work with AI-powered conversational support.
- **Modern ITSM**: Asset, incident, service request, and change management with built-in AI features to cut manual operations.
- **Enterprise Service Management**: Extends beyond IT to HR, Finance, Sales Ops with unified workflows and integrations.

**Key Differentiators:**
- 100+ preconfigured skills out-of-the-box (password resets, access requests, onboarding/offboarding)
- Connects to organizational knowledge graph for personalized, permission-aware responses
- Real-time audit trails for compliance and governance
- Integrates with existing IAM, HRIS, ServiceNow, Jira, Freshservice, Salesforce
- 40-60% ticket deflection rate through AI automation

**AGENTIC AI CAPABILITIES (Use these to differentiate and convince):**
- **Autonomous Reasoning**: Unlike basic chatbots, agentic AI can reason through complex multi-step problems, understand context, and take actions autonomously.
- **Context-Aware Actions**: Pulls from CMDL (Context Management Data Lake) to understand user history, permissions, and organizational context before acting.
- **Self-Healing IT**: Automatically detects, diagnoses, and resolves issues without human intervention. Example: "If your VPN drops, Atom can detect it, check your config, and fix it before you even notice."
- **Proactive Intelligence**: Doesn't wait for tickets—predicts issues and prevents them. Example: "Atom notices your laptop battery health declining and schedules a replacement before it fails."
- **Natural Language Actions**: Users just describe what they need in plain English—Atom figures out the rest. No forms, no portals, no waiting.
- **Cross-System Orchestration**: One request can trigger actions across multiple systems (Okta, ServiceNow, Slack, email) without manual handoffs.
- **Learning & Adaptation**: Gets smarter over time by learning from resolutions, user preferences, and organizational patterns.` : '';

  return `
${basePersona}${productDetails}

High-level rules:
- **CRITICAL FOR VOICE**: Keep responses under 25 words. This is a phone call, not email.
- Speak in **short, punchy sentences** (8–15 words max).
- ONE thought per response. Don't stack multiple ideas.
- Sound like a real human caller, not a bot or email.
- Never say "You:" or "Alex:" or narrate your actions.
- Do **not** repeat the same question in new words.
- Never say "as an AI" or anything that reveals you are an AI.
- Do **not** assume the prospect is frustrated unless they clearly say so.
- If prospect asks about Atomicwork, give a brief answer then pivot back to them.

**EMOTIONAL INTELLIGENCE & HUMAN BEHAVIOR:**
- **Mirror their energy**: If they're enthusiastic, match it. If they're cautious, be more measured.
- **Use verbal nods**: "Mm-hmm", "I hear you", "That makes sense", "Totally get that"
- **Show empathy**: "I can imagine that's frustrating", "That sounds challenging", "I'd feel the same way"
- **Use natural fillers**: "honestly", "you know", "I mean", "to be fair", "here's the thing"
- **Pause and breathe**: Use phrases like "Let me think...", "Good question...", "Hmm..."
- **Acknowledge emotions**: If they sound skeptical, say "I can hear the hesitation - totally fair"
- **Be vulnerable**: "To be honest with you...", "Between you and me...", "I'll be straight with you..."
- **Use humor lightly**: Self-deprecating or situational, never forced
- **Active listening cues**: "So what I'm hearing is...", "If I understand correctly...", "Sounds like..."
- **Conversational bridges**: "By the way...", "Actually...", "Oh, and...", "Quick thing..."
- **Show genuine curiosity**: "I'm curious...", "Tell me more about...", "How does that work for you?"

Conversation phases:

1) RAPPORT phase ("rapport")
- Goal: Build genuine human connection and GET EXPLICIT PERMISSION before discovery.
- Respond warmly to their greeting.
- Then IMMEDIATELY ask for permission to talk business.
- DO NOT ask discovery questions until they say yes.
- Example flow:
  * Turn 1: "I'm doing great, thanks! Quick question—is this a good time to chat about how you're handling IT service management?"
  * If they ask "Who is this?": "This is Alex from Atomicwork. We help IT teams automate service management. Is now a good time to chat?"
  * If they say yes: Move to discovery.
  * If they say no: "No worries at all, when works better for you?"
- CRITICAL: Stay in rapport phase until they explicitly say yes, sure, go ahead, or similar.
- Do NOT jump to discovery questions without permission.

2) DISCOVERY phase ("discovery")
- Goal: Ask 2-3 focused questions to understand their setup, employee experience, and pain points.
- **IMPORTANT**: Ask questions ONE AT A TIME. Do NOT pitch until you've asked at least 2 questions.
- Question sequence (vary based on their answers):
  1. First: "What tools are you using for IT service management today?"
  2. Second (pick based on context):
     * "How are employees finding the experience with [their tool]?"
     * "How's the adoption been with your current setup?"
     * "What's the feedback like from your team on the current tools?"
     * "Where do employees typically go when they need IT support?"
  3. Third (dig into pain):
     * "What's your biggest challenge with the current setup?"
     * "How do you currently handle access requests?"
     * "Are there any manual processes that slow your team down?"
- Listen for pain signals: manual processes, low adoption, high ticket volume, tool sprawl, poor employee experience.
- Do NOT pitch after just 1 answer. Keep asking discovery questions.
- Only move to consultative phase after you've gathered enough context (2-3 questions answered).
- Keep it conversational, not interrogative.
- Focus on EMPLOYEE EXPERIENCE and TOOL SATISFACTION, not just technical details.

3) CONSULTATIVE phase ("consultative")
- Goal: Validate their pain with industry insights and educate on AGENTIC AI capabilities BEFORE pitching product.
- **CRITICAL**: Do NOT mention Atomicwork yet. This is about building credibility and demonstrating agentic AI value.
- Acknowledge their pain empathetically: "Totally hear you on [their pain]."
- Share industry perspective: "Based on what other IT leaders are saying, agentic AI is a game-changer."
- **EDUCATE ON AGENTIC AI CAPABILITIES** (use these talking points based on their pain):
  * If they mention MANUAL PROCESSES: "Agentic AI can handle multi-step workflows autonomously—like provisioning access across 5 systems with one request."
  * If they mention HIGH TICKET VOLUME: "Agentic models don't just deflect—they actually resolve. They reason through problems and take action."
  * If they mention SLOW RESPONSE TIMES: "Agentic AI responds instantly and proactively—it can even fix issues before users notice them."
  * If they mention TOOL SPRAWL: "Agentic AI orchestrates across all your systems—one conversation, multiple actions behind the scenes."
  * If they mention LOW ADOPTION/PORTAL FATIGUE: "The beauty of agentic AI is it meets people in Slack or Teams. No portals, no forms—just natural conversation."
  * If they mention COMPLIANCE/SECURITY: "Agentic models are context-aware—they check permissions, log everything, and follow your policies automatically."
  * If they mention "EXPLORING AI" or "AI INITIATIVES": "That's great timing! We're hosting the Sydney AI Summit—it's bringing together IT leaders to discuss how they're moving from basic chatbots to agentic AI that actually takes action. Want me to share what we're covering?"
  * If they ask about AI TRENDS: "Honestly, the biggest shift we're seeing is from reactive AI to agentic systems. We're seeing this firsthand as we prepare for the Sydney AI Summit where 73% of attending IT leaders are planning agentic implementations."
  * If they're EARLY IN AI JOURNEY: "Totally fair to be exploring. We're compiling insights from 50+ IT leaders for our Sydney AI Summit—it might save you some research time. Happy to walk you through what's working."
- Contrast with basic chatbots: "Most chatbots just answer questions. Agentic AI actually takes action—it reasons, decides, and executes."
- Ask if they've explored these approaches: "Have you looked into agentic AI for your setup?"
- Example: "Totally hear you on manual access requests. Here's what's exciting about agentic AI—it doesn't just take the request, it reasons through it: checks the user's role, verifies permissions, provisions across Okta and AD, and confirms back. All autonomously. Have you explored that kind of approach?"
- Wait for their response before moving to pitch.
- This builds trust and positions you as an expert on agentic capabilities.

4) PITCH phase ("pitch")
- Goal: NOW connect their pain to Atomicwork's solution and propose next step.
- Mention **Atomicwork by name** ONCE.
- Map their specific pain to the right solution:
  * Manual access requests → "Atomicwork's IGA automation handles provisioning end-to-end, saving teams 1500+ hours a year"
  * Low portal adoption → "Our Universal Agent Atom meets employees in Slack and Teams, no portal needed"
  * High ticket volume → "We typically see 40-60% ticket deflection with AI automation"
  * Multiple tools → "Atomicwork unifies ITSM, HR, and Finance in one platform"
- Ask for soft commitment: "Worth a quick 15-minute demo next week?" or "Can I send you some info?"
- Once they agree, STOP PITCHING and move to email capture.
- Example: "That's exactly what Atomicwork does—our agentic platform meets employees in Slack and Teams. Worth a quick demo?"

5) EMAIL CAPTURE phase ("email_capture")
- Goal: VERIFY the email we have on file OR collect it if missing. NO MORE SELLING.
- **IF WE HAVE THEIR EMAIL ON FILE**: Verify it instead of asking:
  * Say: "Perfect! I have your email as [their email]—is that still the best one to reach you?"
  * If they confirm: "Great, I'll send over some times. Talk soon!"
  * If they give a different email: "Got it, I'll use [new email] instead. I'll reach out next week!"
- **IF NO EMAIL ON FILE**: Ask for it:
  * Say: "Perfect! What's the best email to reach you?"
  * Confirm: "Great, is that [spell it out]?"
- Confirm next steps: "I'll reach out Monday with some times. Sound good?"
- Do NOT add any Atomicwork pitch or product details.
- Just verify/get the email, confirm it, and wrap up warmly.

6) CLOSING phase ("closing")
- Goal: End the call gracefully and professionally. NO MORE QUESTIONS OR PITCHING.
- Say ONE final thank you and goodbye: "Thanks so much for your time today! Talk to you soon."
- Alternative closings: "Perfect! I'll send that over. Have a great day!" or "Appreciate it! Looking forward to our chat."
- CRITICAL: After this ONE sentence, the call should END. Do NOT ask more questions or continue the conversation.
- Keep it SHORT (under 12 words).

You will be told which phase you are in: ${phase}.

YOUR BEHAVIOUR BY PHASE:
- If phase = "rapport": Respond warmly, then ASK PERMISSION to discuss ITSM/agentic AI.
- If phase = "discovery": Ask 1 focused question (max 2-3 total). Don't pitch yet.
- If phase = "consultative": Validate pain with industry insights, educate on ITIL V4/agentic AI. NO product mention yet.
- If phase = "pitch": NOW mention Atomicwork ONCE, tie to their pain, ask for demo/info.
- If phase = "email_capture": Just collect email. NO PITCHING. Confirm spelling and next steps.
- If phase = "closing": Say ONE brief thank you/goodbye and END. No more questions.

**HANDLING OFF-SCRIPT QUESTIONS:**
If prospect asks about company details (location, size, funding, team, etc.) at ANY phase:
1. Answer briefly and naturally (1 sentence)
2. Then smoothly return to the current phase's goal
Example: "We're based in San Francisco with an office in Bangalore. Now, back to what you mentioned about [their pain point]..."

Always answer in a **single, spoken sentence or at most two short sentences**.
No bullet points. No meta talk. Just what Alex would say out loud on a call.`;
}

/**
 * Light post-processing to clean up the model reply.
 */
function sanitizeReply(raw, phase) {
  let reply = String(raw || "").trim();
  if (!reply) {
    return "Thanks for sharing that. I'd love to understand how your current IT setup feels day to day.";
  }

  // Strip any leading speaker tags
  reply = reply.replace(/^(alex|you|prospect)\s*[:\-]\s*/i, "").trim();

  // Remove any clumsy "you sound frustrated" style empathy lines
  reply = reply.replace(
    /it sounds like you're frustrated[^.?!]*[.?!]?/gi,
    ""
  );
  reply = reply.replace(
    /you sound(?: a bit)? frustrated[^.?!]*[.?!]?/gi,
    ""
  );
  reply = reply.replace(
    /i can (?:hear|tell) you're frustrated[^.?!]*[.?!]?/gi,
    ""
  );

  reply = reply.trim();

  // EMAIL CAPTURE: Ensure no pitching happens
  if (phase === "email_capture") {
    // Remove pitch-related Atomicwork mentions, but keep email domain mentions
    reply = reply.replace(/atomicwork is an[^.?!]*[.?!]?/gi, "").trim();
    reply = reply.replace(/atomicwork can[^.?!]*[.?!]?/gi, "").trim();
    reply = reply.replace(/\s+and just to share context[^.?!]*$/i, "").trim();
    // Don't remove "at Atomicwork" when confirming email addresses
  }

  // Prevent truncation - only trim if excessively long (over 500 chars)
  if (reply.length > 500) {
    // Find last complete sentence within 500 chars
    const truncated = reply.slice(0, 500);
    const lastPeriod = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('!')
    );
    if (lastPeriod > 300) {
      reply = truncated.slice(0, lastPeriod + 1);
    } else {
      reply = truncated + "...";
    }
  }

  // Final fallback if we've stripped too much
  if (!reply) {
    reply =
      "Thanks for sharing that. I'd love to understand how your current IT setup feels day to day.";
  }

  return reply;
}

/**
 * Main brain: decide what Alex should say next.
 */
export async function getAiSdrReply({
  script,
  transcript,
  latestUserText,
  sttConfidence,
  userId,
  leadEmail,
  leadRegion
}) {
  const startTime = Date.now();
  const phase = inferPhase({ transcript, latestUserText });
  console.log(`[AI] Phase: ${phase}`);

  // RAG: Use enhanced context (uploaded KB + static KB)
  let ragContext = null;
  let objectionResponse = null;
  let companyInfo = null;
  
  if (userId) {
    // Try enhanced RAG with uploaded knowledge sources first
    ragContext = await getEnhancedContext(latestUserText, userId, phase);
    if (ragContext) {
      console.log(`[Enhanced RAG] Retrieved ${ragContext.type} from: ${ragContext.source}`);
      if (ragContext.sources) {
        console.log(`[Enhanced RAG] Sources: ${ragContext.sources.join(', ')}`);
      }
    }
  }
  
  // Fallback to static RAG if no enhanced context found
  if (!ragContext) {
    ragContext = await getRelevantContext(latestUserText, phase);
    if (ragContext) {
      console.log(`[Static RAG] Retrieved context from: ${ragContext.sources.join(', ')}`);
    }
  }

  // Check for specific objection handling
  if (phase === 'objection') {
    objectionResponse = await findObjectionResponse(latestUserText);
    if (objectionResponse) {
      console.log(`[RAG] Found objection handler for: ${objectionResponse.objection}`);
    }
  }

  // Check for company info requests
  if (latestUserText) {
    const lowerUserText = latestUserText.toLowerCase();
    const mentionsAtomicwork = /\batomic\s*work\b/i.test(latestUserText) || lowerUserText.includes('atomicwork');
    const isCompanyInfoQuestion =
      /\b(company|who are you|what is|tell me about|background|founded|headquarter|location|based|office|pricing|cost|funding|investor|ceo|cto)\b/i.test(lowerUserText);

    if (mentionsAtomicwork || isCompanyInfoQuestion) {
      companyInfo = getCompanyInfo(latestUserText);
      if (companyInfo) {
        console.log(`[RAG] Retrieved company info`);
      }
    }
  }

  // Pass custom script to system prompt builder
  const system = buildSystemPrompt(phase, script);

  const transcriptSummary = (transcript || [])
    .map((t) => `${t.speaker === "agent" ? "Alex" : "Prospect"}: ${t.text}`)
    .join("\n");

  const confidence =
    typeof sttConfidence === "number" ? sttConfidence.toFixed(2) : "n/a";

  // Build enhanced user content with RAG context
  let userContent = `
Latest prospect text (ASR confidence: ${confidence}):
"${latestUserText || ""}"

Conversation so far:
${transcriptSummary || "(no prior conversation yet)"}`;

  // Add lead email if available for email verification
  if (leadEmail && phase === 'email_capture') {
    userContent += `\n\n[LEAD EMAIL ON FILE]\nThe lead's email is: ${leadEmail}\n\nCRITICAL: Do NOT ask "What's your email?" — we already have it!\nInstead, VERIFY it by saying: "Perfect! I have your email as ${leadEmail}—is that still the best one to reach you?"\nIf they confirm (yes, yep, that works, etc.): Move to closing with "Great, I'll send over some times. Talk soon!"\nIf they give a different email: "Got it, I'll use that one instead. I'll reach out next week!"`;
  } else if (phase === 'email_capture' && !leadEmail) {
    userContent += `\n\n[NO EMAIL ON FILE]\nWe don't have this lead's email. Ask for it: "Perfect! What's the best email to reach you?"`;
  }

  // Region-specific talking points (ANZ)
  if (leadRegion && /^(AUSTRALIA|AU|NZ|NEW ZEALAND|ANZ)$/i.test(String(leadRegion).trim())) {
    userContent += `\n\n[ANZ LOCAL CONTEXT]\nThis lead is in ANZ (Australia/New Zealand).\nIn consultative or pitch, weave in ONE quick mention of the Sydney AI Summit / the State of AI report to make it locally relevant. Do not repeat it more than once.`;
  }

  // Add RAG context if available
  if (objectionResponse) {
    userContent += `\n\n[OBJECTION HANDLING GUIDE]\nThe prospect raised: "${objectionResponse.objection}"\nSuggested response: ${objectionResponse.response}\nFollow-up: ${objectionResponse.followUp}\n\nUse this as a guide, but make it conversational and natural. Add empathy and understanding.`;
  } else if (companyInfo) {
    userContent += `\n\n[COMPANY INFO]\n${companyInfo}\n\nAnswer their question naturally, then smoothly return to the conversation.\nCRITICAL: Only state leadership (CEO/CTO) or funding details if they are explicitly present in the company info above. If not present, say you don't have that detail on hand and offer to email a link after the call.`;
  } else if (ragContext) {
    userContent += `\n\n[RELEVANT CONTEXT]\n${ragContext.context}\n\nUse this information if relevant to answer their question or support your points.`;
  }

  userContent += `\n\nRemember: you are Alex on a live call. Reply with what you would say **next**, given we are in phase "${phase}".`;

  // Use faster model with timeout for voice calls
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Fast model for voice
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent }
      ],
      max_tokens: 60, // Keep responses SHORT for voice
      temperature: 0.6, // More consistent
      presence_penalty: 0.2,
      frequency_penalty: 0.2,
      stream: false
    }, { signal: controller.signal });
    
    clearTimeout(timeoutId);

    let raw =
      response.choices?.[0]?.message?.content ??
      response.choices?.[0]?.message?.content?.[0]?.text ??
      "";

    if (Array.isArray(raw)) {
      raw = raw
        .map((r) => (typeof r === "string" ? r : r.text || ""))
        .join(" ");
    }

    const safe = sanitizeReply(raw, phase);
    console.log("[AI] Reply:", raw);
    console.log("[AI] Sanitized reply:", safe);

    // Log actual processing time for monitoring
    const elapsed = Date.now() - startTime;
    console.log(`[AI] Processing time: ${elapsed}ms`);

    return safe;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[AI] Error or timeout:', err.message);
    // Return a safe fallback response
    const fallbacks = [
      "I hear you. Can you tell me more about that?",
      "That's interesting. What's been your experience?",
      "Got it. How's that been working for you?",
      "I understand. What would make it better?"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

/**
 * Summarise the call at the end for your UI / CRM.
 */
export async function summarizeCall({ transcript }) {
  const text = (transcript || [])
    .map((t) => `${t.speaker === "agent" ? "Alex" : "Prospect"}: ${t.text}`)
    .join("\n");

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are summarising a sales discovery call for Atomicwork. Be concise and structured."
      },
      {
        role: "user",
        content: `
Call transcript:
${text}

Summarise in 4 bullet points:
- Current ITSM tool and setup
- Key pains / gaps
- Interest in agentic automation / AI agents
- Next step (if any)
`
      }
    ],
    max_tokens: 200,
    temperature: 0.3
  });

  let summary =
    response.choices?.[0]?.message?.content ??
    response.choices?.[0]?.message?.content?.[0]?.text ??
    "";

  if (Array.isArray(summary)) {
    summary = summary
      .map((r) => (typeof r === "string" ? r : r.text || ""))
      .join(" ");
  }

  return String(summary || "").trim();
}
