// backend/claudeClient.js
// AI voice + summarization brain — replaces openaiClient.js
// Voice: Groq primary (200ms) → Claude Haiku fallback (400ms)
// Research/scripts/personas: Claude Sonnet / Opus

import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import {
  findObjectionResponse,
  getRelevantContext,
  getCompanyInfo,
  getCustomerStory
} from "./services/rag-service.js";
import { getEnhancedContext } from "./services/enhanced-rag-service.js";
import { getCachedResponse, needsAI } from "./responseCache.js";

// ─── Models ──────────────────────────────────────────────────────────────────

export const CLAUDE_MODELS = {
  haiku:  "claude-haiku-4-5-20251001",  // Fast — fallback voice, simple tasks
  sonnet: "claude-sonnet-4-6",           // Balanced — research, enrichment
  opus:   "claude-opus-4-6",            // Best — scripts, personas
};

export const GROQ_MODELS = {
  fast:    "llama-3.1-8b-instant",      // Primary voice (~200ms)
  quality: "llama-3.3-70b-versatile",   // Higher quality, still fast
};

// ─── Clients ─────────────────────────────────────────────────────────────────

let _anthropic = null;
function getAnthropicClient() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

let _groq = null;
function getGroqClient() {
  if (!_groq && process.env.GROQ_API_KEY) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// ─── Phase Detection ─────────────────────────────────────────────────────────

function inferPhase({ transcript = [], latestUserText = "" }) {
  const turnCount = transcript ? transcript.length : 0;
  const text = (latestUserText || "").toLowerCase();

  const permissionGranted = transcript.some(t =>
    t.speaker === "prospect" &&
    /yes|sure|yeah|go ahead|good time|let'?s talk|sounds good/i.test(t.text)
  );

  const discoveryQuestions = transcript.filter(t =>
    t.speaker === "agent" &&
    /what tools|how do you|how'?s|where do employees|what's your biggest|how are employees|tell me about/i.test(t.text)
  ).length;

  const hasEducated = transcript.some(t =>
    t.speaker === "agent" &&
    /itil|agentic ai|meeting employees where they are|slack.*teams|industry trend|other it leaders/i.test(t.text)
  );

  const emailCaptured = transcript.some(t =>
    t.speaker === "agent" && /email|send (you|over)|follow.?up/i.test(t.text)
  ) && transcript.some(t =>
    t.speaker === "prospect" && /@/.test(t.text)
  );

  if (emailCaptured) return "closing";

  const wantsEmail = /email|send (me|over|that)|follow.?up|report|details|information/i.test(text) ||
    transcript.some(t => t.speaker === "prospect" && /email|send.*over|follow.?up/i.test(t.text));
  if (wantsEmail && turnCount > 4) return "email_capture";

  const hasObjection = /no|not|busy|already|happy|don't|using|expensive|another|not interested/i.test(text);
  if (hasObjection) return "objection";

  if (!permissionGranted && turnCount <= 2) return "rapport";
  if (permissionGranted && discoveryQuestions < 2) return "discovery";
  if (permissionGranted && discoveryQuestions >= 2 && !hasEducated) return "consultative";
  if (permissionGranted && hasEducated) return "pitch";
  if (turnCount > 6) return "pitch";

  return "discovery";
}

// ─── Prompt Building ─────────────────────────────────────────────────────────

function buildVoiceSystemPrompt({ phase, voicePersona = "Arabella", leadName, leadContext = {}, script, ragContext = null }) {
  const persona = leadContext.linkedinPersona || {};
  const discProfile = persona.discProfile || "Unknown";
  const talkingPoints = (leadContext.talkingPoints || []).slice(0, 3);
  const prospectCompany = leadContext.prospectCompany || leadContext.company || "";
  const prospectTitle = leadContext.title || "";

  const discMap = {
    D: "DISC D-type: Direct, results-focused. Get to the point. Use ROI language.",
    I: "DISC I-type: Enthusiastic, social. Build rapport. Use emotional, story-driven language.",
    S: "DISC S-type: Steady, supportive. Be patient and empathetic. Emphasise stability.",
    C: "DISC C-type: Analytical. Be precise and data-driven. Back claims with numbers.",
  };

  const phaseInstructions = {
    rapport:      `Confirm you have the right person, get permission to continue (30s max). Ask: "Is this ${leadName}?" then "Is this a good time for 30 seconds?"`,
    discovery:    `Ask ONE focused question about their IT service management pain points. Don't pitch yet.`,
    consultative: `Share a relevant industry insight. Make them think, not sell. Example: "Most IT teams we talk to are drowning in Level 1 tickets — is that true for you?"`,
    pitch:        `Connect Atomicwork to their specific pain point. Propose a 15-minute demo. 3 sentences max.`,
    objection:    `Handle empathetically. Validate, reframe, offer something low-commitment. Never argue.`,
    email_capture:`Get their email address warmly. "I'll send you our IT efficiency report — what email works best?"`,
    closing:      `Confirm next steps. Lock in the demo date if agreed. End positively.`,
  };

  return `You are ${voicePersona}, an SDR at Atomicwork, on a phone call with ${leadName}${prospectTitle ? `, ${prospectTitle}` : ""}${prospectCompany ? ` at ${prospectCompany}` : ""}.

RULES:
- 1-2 SHORT sentences MAX (under 25 words)
- Sound natural and human — phone call, not email
- NEVER say "I'm an AI", never narrate actions, no asterisks
- Phase: ${phase.toUpperCase()}
${discMap[discProfile] ? `Personality: ${discMap[discProfile]}` : ""}

GOAL: ${phaseInstructions[phase] || phaseInstructions.discovery}
${script ? `\nSCRIPT (guide only):\n${script.substring(0, 800)}` : ""}
${ragContext ? `\nCONTEXT:\n${ragContext.substring(0, 500)}` : ""}
${talkingPoints.length ? `\nTALKING POINTS:\n${talkingPoints.map(p => `- ${p}`).join("\n")}` : ""}

Reply ONLY with what you'd say aloud. No labels, no quotes.`;
}

// ─── Voice Reply: Groq primary → Claude fallback ─────────────────────────────

export async function getAiSdrReply({ transcript = [], latestUserText = "", callSid, leadName = "there", voicePersona = "Arabella", script, leadContext = {} }) {
  // Cache check
  if (needsAI && getCachedResponse) {
    if (!needsAI(latestUserText)) return null;
    const cached = await getCachedResponse(latestUserText);
    if (cached) return cached;
  }

  const phase = inferPhase({ transcript, latestUserText });
  console.log(`[AI] Phase: ${phase} | "${latestUserText.substring(0, 50)}"`);

  // RAG context
  let ragContext = null;
  try {
    const objResponse = findObjectionResponse(latestUserText);
    if (objResponse) {
      ragContext = `OBJECTION RESPONSE: ${objResponse}`;
    } else {
      const [rel, enh] = await Promise.allSettled([
        getRelevantContext(latestUserText, phase),
        getEnhancedContext(latestUserText),
      ]);
      const r = rel.status === "fulfilled" ? rel.value : null;
      const e = enh.status === "fulfilled" ? enh.value : null;
      ragContext = (e?.context || r?.context || "").substring(0, 500);
    }
  } catch (err) {
    console.warn("[AI] RAG error (non-fatal):", err.message);
  }

  const systemPrompt = buildVoiceSystemPrompt({ phase, voicePersona, leadName, leadContext, script, ragContext });
  const userPrompt = latestUserText || "[silence]";
  const startTime = Date.now();

  // 1. Groq primary (fastest)
  const groq = getGroqClient();
  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        model: GROQ_MODELS.fast,
        max_tokens: 60,
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });
      const reply = completion.choices[0]?.message?.content?.trim() || "";
      if (reply) {
        console.log(`[Groq] ${Date.now() - startTime}ms: "${reply.substring(0, 60)}"`);
        return reply;
      }
    } catch (err) {
      console.warn("[Groq] Failed, falling back to Claude:", err.message);
    }
  }

  // 2. Claude Haiku fallback
  try {
    const claude = getAnthropicClient();
    const response = await claude.messages.create({
      model: CLAUDE_MODELS.haiku,
      max_tokens: 60,
      temperature: 0.6,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const reply = response.content[0]?.text?.trim() || "";
    console.log(`[Claude Haiku] ${Date.now() - startTime}ms: "${reply.substring(0, 60)}"`);
    return reply;
  } catch (error) {
    console.error(`[Claude] Error after ${Date.now() - startTime}ms:`, error.message);
    const fallbacks = {
      rapport: "Hey, sorry — is this a good time for 30 seconds?",
      objection: "I completely understand. Can I send you a quick overview instead?",
      default: "Sorry, I missed that — could you say that again?",
    };
    return fallbacks[phase] || fallbacks.default;
  }
}

// ─── Call Summarization ───────────────────────────────────────────────────────

export async function summarizeCall(transcript = []) {
  if (!transcript || transcript.length === 0) return { summary: "No transcript available." };

  const transcriptText = transcript
    .map(t => `${t.speaker === "agent" ? "Alex (SDR)" : "Prospect"}: ${t.text}`)
    .join("\n");

  try {
    const claude = getAnthropicClient();
    const response = await claude.messages.create({
      model: CLAUDE_MODELS.sonnet,
      max_tokens: 500,
      temperature: 0.3,
      system: "You are an expert sales analyst. Summarize sales calls concisely.",
      messages: [{
        role: "user",
        content: `Summarize this call as valid JSON only:
{ "summary": "...", "painPoints": [], "interestLevel": "hot|warm|cold", "objections": [], "nextSteps": "...", "followUpAction": "..." }

TRANSCRIPT:
${transcriptText}`,
      }],
    });

    const content = response.content[0]?.text || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: content };
  } catch (error) {
    console.error("[Claude] summarizeCall error:", error.message);
    return { summary: "Failed to generate summary." };
  }
}

// ─── Generic Claude helper (used by services) ────────────────────────────────

export async function claudeReply({ system, prompt, model = CLAUDE_MODELS.haiku, maxTokens = 500, temperature = 0.7 }) {
  const claude = getAnthropicClient();
  const response = await claude.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0]?.text?.trim() || "";
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function healthCheck() {
  const result = { anthropic: { available: false }, groq: { available: false } };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const start = Date.now();
      await getAnthropicClient().messages.create({
        model: CLAUDE_MODELS.haiku,
        max_tokens: 5,
        messages: [{ role: "user", content: 'Say "ok"' }],
      });
      result.anthropic = { available: true, model: CLAUDE_MODELS.haiku, latency: `${Date.now() - start}ms` };
    } catch (e) {
      result.anthropic = { available: false, reason: e.message };
    }
  } else {
    result.anthropic = { available: false, reason: "ANTHROPIC_API_KEY not set" };
  }

  const groq = getGroqClient();
  if (groq) {
    try {
      const start = Date.now();
      await groq.chat.completions.create({
        model: GROQ_MODELS.fast,
        max_tokens: 5,
        messages: [{ role: "user", content: 'Say "ok"' }],
      });
      result.groq = { available: true, model: GROQ_MODELS.fast, latency: `${Date.now() - start}ms` };
    } catch (e) {
      result.groq = { available: false, reason: e.message };
    }
  } else {
    result.groq = { available: false, reason: "GROQ_API_KEY not set" };
  }

  return result;
}
