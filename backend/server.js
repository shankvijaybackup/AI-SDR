import dotenv from 'dotenv';
import path from 'path';
import fs from "fs";
import { randomUUID } from "crypto";

// Load .env - try app directory first, then current directory
const envPath = fs.existsSync(path.resolve(process.cwd(), 'app/.env'))
  ? path.resolve(process.cwd(), 'app/.env')
  : path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import twilio from "twilio";
import helmet from "helmet";
import cookieParser from "cookie-parser";

// ========== GLOBAL ERROR HANDLERS - PREVENT CRASHES ==========
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - keep server running
});

import {
  initCall,
  updateCall,
  addTranscript,
  getCall,
  listCalls
} from "./callState.js";
import { createOutboundCall } from "./twilioClient.js";
import { getAiSdrReply, summarizeCall } from "./openaiClient.js";
import { attachMediaStreamServer } from "./mediaStreamServer.js";
import { attachRealtimeVoiceServer } from "./realtimeVoiceServer.js";
import { voiceRealtimeWebhook } from "./routes/voice-realtime.js";
import { voiceMediaStreamWebhook } from "./routes/voice-media-stream.js";
import accountsRouter from "./routes/accounts.js";
import { initiateCall, getActiveCall, updateCallTranscript, endCall } from "./routes/initiate-call.js";
import integrationsRouter from "./routes/integrations.js";
import { synthesizeWithChatterbox as chatterboxSynthesize, healthCheck as chatterboxHealth } from "./chatterboxClient.js";
import { startCampaign, handleCallComplete, controlCampaign } from "./services/bulkCallManager.js";
import { synthesizeWithDeepgram, healthCheck as deepgramHealth } from "./deepgramTTSClient.js";
import { getCachedResponse, needsAI } from "./responseCache.js";
import { addFillerToResponse, getFillerPhrase } from "./fillerWords.js";

// ========== SCALABILITY: Import Sentry and Rate Limiting ==========
import { initSentry, sentryErrorHandler } from "./config/sentry.js";
import { apiLimiter, strictLimiter, readLimiter } from "./middleware/rateLimiter.js";

const app = express();

const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const ELEVEN_VOICE_ID_MALE = process.env.ELEVEN_VOICE_ID_MALE;
const ELEVEN_VOICE_ID_FEMALE = process.env.ELEVEN_VOICE_ID_FEMALE;
const USE_CHATTERBOX = process.env.USE_CHATTERBOX === "true";
const CHATTERBOX_VOICE_MALE = process.env.CHATTERBOX_VOICE_MALE || "alex";
const CHATTERBOX_VOICE_FEMALE = process.env.CHATTERBOX_VOICE_FEMALE || "sarah";
const TTS_DIR = path.join(process.cwd(), "tts_files");

// Voice selection: use Redis-based voice mapping for distributed state
import { setVoiceForCall as setVoiceRedis, getVoiceForCall as getVoiceRedis } from './voiceMap.js';

async function getVoiceIdForCall(callSid) {
  // First check if voice was set in Redis
  const voiceId = await getVoiceRedis(callSid);
  if (voiceId) {
    return voiceId;
  }

  // Fallback to default voice (shouldn't happen with new system)
  console.warn(`[Voice] No voice found for callSid ${callSid}, using fallback`);
  const defaultVoice = USE_CHATTERBOX ? CHATTERBOX_VOICE_FEMALE : ELEVEN_VOICE_ID_FEMALE;
  await setVoiceRedis(callSid, defaultVoice);
  return defaultVoice;
}

// Export function to set voice for a call (called from initiate-call.js)
export async function setVoiceForCall(callSid, voiceId) {
  await setVoiceRedis(callSid, voiceId);
  console.log(`[Voice] Set voice ${voiceId} for call ${callSid}`);
}

if (!fs.existsSync(TTS_DIR)) {
  fs.mkdirSync(TTS_DIR, { recursive: true });
  console.log("✅ Created TTS directory:", TTS_DIR);
}

// ========== SCALABILITY: Initialize Sentry Error Monitoring ==========
initSentry(app);

// ========== SCALABILITY: Security Headers with Helmet ==========
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true
}));

// Middlewares
app.use(cors({
  origin: [FRONTEND_ORIGIN, "http://localhost:3000", "https://ai-sdr-web.onrender.com"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));

// Parse cookies
app.use(cookieParser());

// Parse JSON bodies (must come before routes)
app.use(bodyParser.json());

app.use('/api/integrations', integrationsRouter);
app.use('/api/accounts', accountsRouter);

// Import and register leads routes
import leadsRouter from "./routes/leads.js";
app.use('/api/leads', leadsRouter);

// Import and register scripts routes
import scriptsRouter from "./routes/scripts.js";
app.use('/api/scripts', scriptsRouter);

// Import and register users routes
import usersRouter from "./routes/users.js";
app.use('/api/users', usersRouter);

// Import and register signal routes
import signalsRouter from "./routes/signals.js";
app.use('/api/signals', signalsRouter);

// Import and register AI generator routes
import generatorsRouter from "./routes/generators.js";
app.use('/api/generate', generatorsRouter);

// Import and register lead scripts routes
import leadScriptsRouter from "./routes/lead-scripts.js";
app.use('/api/leads', leadScriptsRouter);

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Twilio sends x-www-form-urlencoded to webhooks
app.use("/api/twilio", bodyParser.urlencoded({ extended: false }));

// ========== SCALABILITY: Apply Rate Limiting ==========
// Global rate limiting for all API routes
app.use('/api/', apiLimiter);

import twilioWebhookRouter from "./routes/twilio-webhooks.js";
app.use("/api/twilio", twilioWebhookRouter);

// Serve synthesized TTS files so Twilio can <Play> them
app.use("/tts", express.static(TTS_DIR));

// ========== SCALABILITY: Health Check Endpoints ==========
import { healthCheck, readinessCheck, livenessCheck } from "./routes/health.js";
app.get("/health", healthCheck);
app.get("/ready", readinessCheck);
app.get("/live", livenessCheck);

// Import Persona Service
import { generateCompanyPersona } from "./services/personaService.js";
// Import Twilio Number Management
import { searchAvailableNumbers, purchaseNumber, releaseNumber } from "./routes/twilio-numbers.js";

// ---------- PERSONA GENERATION ROUTE ----------
app.post("/api/knowledge/persona", async (req, res) => {
  try {
    const { url, companyName, existingKnowledge } = req.body;
    if (!url || !companyName) {
      return res.status(400).json({ error: "Missing url or companyName" });
    }

    if (existingKnowledge) {
      console.log(`[API] Received ${existingKnowledge.length} chars of existing knowledge`);
    }

    // Call the multi-AI service with optional existing knowledge
    const persona = await generateCompanyPersona(url, companyName, existingKnowledge);

    res.json({ persona });
  } catch (err) {
    console.error("[API] Persona generation failed:", err);
    res.status(500).json({ error: "Failed to generate persona", details: err.message });
  }
});

// ---------- TWILIO NUMBER MANAGEMENT ROUTES ----------
app.get("/api/twilio-numbers/search", searchAvailableNumbers);
app.post("/api/twilio-numbers/purchase", purchaseNumber);
app.delete("/api/twilio-numbers/release", releaseNumber);

// ---------- TWILIO CALL SYNC ROUTES ----------
import { syncTwilioCalls, getTwilioUsage, fetchTwilioCalls } from "./services/twilioSync.js";

// Sync historical call data from Twilio API to database
app.post("/api/twilio/sync-history", async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.body;
    const options = {
      limit: limit || 100
    };
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    console.log("[API] Starting Twilio call sync...");
    const results = await syncTwilioCalls(options);
    res.json({ success: true, ...results });
  } catch (err) {
    console.error("[API] Twilio sync failed:", err);
    res.status(500).json({ error: "Failed to sync Twilio calls", details: err.message });
  }
});

// Get Twilio usage summary (calls this month, duration, etc.)
app.get("/api/twilio/usage", async (req, res) => {
  try {
    console.log("[API] Fetching Twilio usage...");
    const usage = await getTwilioUsage();
    res.json({ success: true, usage });
  } catch (err) {
    console.error("[API] Twilio usage fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch Twilio usage", details: err.message });
  }
});

// Get raw Twilio call logs (without syncing to DB)
app.get("/api/twilio/calls", async (req, res) => {
  try {
    const { startDate, endDate, status, limit } = req.query;
    const options = {
      limit: parseInt(limit) || 50
    };
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (status) options.status = status;

    console.log("[API] Fetching Twilio calls...");
    const calls = await fetchTwilioCalls(options);
    res.json({ success: true, count: calls.length, calls });
  } catch (err) {
    console.error("[API] Twilio calls fetch failed:", err);
    res.status(500).json({ error: "Failed to fetch Twilio calls", details: err.message });
  }
});


// ---------- ElevenLabs TTS Helper ----------

// Timeout wrapper for async operations
function withTimeout(promise, ms, errorMsg = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
}

// Truncate text to prevent long TTS calls
function truncateForTTS(text, maxLength = 200) {
  if (text.length <= maxLength) return text;
  // Find last sentence boundary before maxLength
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastQuestion = truncated.lastIndexOf('?');
  const lastExclaim = truncated.lastIndexOf('!');
  const lastBoundary = Math.max(lastPeriod, lastQuestion, lastExclaim);
  if (lastBoundary > 50) {
    return text.substring(0, lastBoundary + 1);
  }
  return truncated + '...';
}

export async function synthesizeWithElevenLabs(text, callSid, voiceId = null) {
  if (!ELEVEN_API_KEY || !PUBLIC_BASE_URL) {
    throw new Error("Missing ElevenLabs env vars or PUBLIC_BASE_URL.");
  }

  // Truncate long text to prevent slow TTS
  const truncatedText = truncateForTTS(text, 150); // Reduced from 180 for faster TTS

  // Use provided voiceId, or fall back to call mapping, or default
  const finalVoiceId = voiceId || getVoiceIdForCall(callSid) || ELEVEN_VOICE_ID_MALE || 'ii4A6dlr1lY1vmNfjQlX';
  const voiceType = finalVoiceId === ELEVEN_VOICE_ID_FEMALE ? "Female" : (finalVoiceId === ELEVEN_VOICE_ID_MALE ? "Male" : "Regional");
  console.log(`[ElevenLabs] Synthesizing (${voiceType}) with voice ${finalVoiceId.substring(0, 8)}... for ${callSid}:`, truncatedText.substring(0, 50) + '...');

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`;

  // Add timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced from 8s for faster fallback

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text: truncatedText,
        model_id: "eleven_turbo_v2_5", // Faster model
        voice_settings: {
          stability: 0.9,            // MAXIMUM stability for loud consistent voice
          similarity_boost: 1.0,     // MAXIMUM clarity
          style: 0.0,
          use_speaker_boost: true
        },
        output_format: "mp3_44100_128"  // Higher bitrate = louder, clearer audio
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ElevenLabs] Error:", res.status, errText);
      throw new Error(`ElevenLabs TTS failed: ${res.status}`);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    const id = randomUUID();
    const filename = `${id}.mp3`;
    const filepath = path.join(TTS_DIR, filename);

    await fs.promises.writeFile(filepath, audioBuffer);

    const publicUrl = `${PUBLIC_BASE_URL}/tts/${filename}`;
    console.log("[ElevenLabs] Audio ready at:", publicUrl);
    return publicUrl;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error('[ElevenLabs] Request timed out');
      throw new Error('ElevenLabs TTS timed out');
    }
    throw err;
  }
}

// ---------- Chatterbox TTS Helper ----------

export async function synthesizeWithChatterboxTTS(text, callSid) {
  if (!PUBLIC_BASE_URL) {
    throw new Error("Missing PUBLIC_BASE_URL.");
  }

  const voiceId = getVoiceIdForCall(callSid);
  const voiceType = voiceId === CHATTERBOX_VOICE_FEMALE ? "Female" : "Male";
  console.log(`[Chatterbox] Synthesizing (${voiceType}) for ${callSid}:`, text);

  const audioBuffer = await chatterboxSynthesize(text, voiceId, {
    exaggeration: 0.5,
    cfg_weight: 0.5,
    output_format: "mp3"
  });

  const id = randomUUID();
  const filename = `${id}.mp3`;
  const filepath = path.join(TTS_DIR, filename);

  await fs.promises.writeFile(filepath, Buffer.from(audioBuffer));

  const publicUrl = `${PUBLIC_BASE_URL}/tts/${filename}`;
  console.log("[Chatterbox] Audio ready at:", publicUrl);
  return publicUrl;
}

// ---------- Unified TTS Helper (Auto-switch with Deepgram priority) ----------
// Try Deepgram first (fastest ~100-200ms), then ElevenLabs, then Chatterbox
// Set USE_DEEPGRAM=true in env to enable Deepgram (requires DEEPGRAM_API_KEY)
const USE_DEEPGRAM = process.env.USE_DEEPGRAM === 'true' && process.env.DEEPGRAM_API_KEY;

// Check if region requires ElevenLabs (regions where accent matters)
function requiresElevenLabs(region) {
  if (!region) return false;
  const r = String(region).toLowerCase().trim();
  // India, UK, Australia, ANZ - use ElevenLabs for proper accents
  // Deepgram only has American English voices
  return ['india', 'in', 'uk', 'australia', 'au', 'anz', 'nz'].some(x => r.includes(x));
}

export async function synthesizeTTS(text, callSid, voicePersona = null, region = null, voiceId = null) {
  // For regions requiring specific accents, skip Deepgram and use ElevenLabs directly
  // This ensures India gets Indian English voices, UK gets UK voices, etc.
  if (requiresElevenLabs(region)) {
    console.log(`[TTS] Region ${region} requires ElevenLabs for proper accent`);
    // Get voice ID from call state if not provided
    const callVoiceId = voiceId || getVoiceIdForCall(callSid);
    return await synthesizeWithElevenLabs(text, callSid, callVoiceId);
  }

  // Try Deepgram first if enabled (fastest: ~100-200ms) - only for US/default
  if (USE_DEEPGRAM) {
    try {
      return await synthesizeWithDeepgram(text, callSid, voicePersona, region);
    } catch (err) {
      console.warn('[TTS] Deepgram failed, falling back to ElevenLabs:', err.message);
    }
  }

  // Fallback to Chatterbox or ElevenLabs
  if (USE_CHATTERBOX) {
    return await synthesizeWithChatterboxTTS(text, callSid);
  } else {
    return await synthesizeWithElevenLabs(text, callSid);
  }
}

// ---------- Helper: simple script registry in-memory ----------
const scripts = new Map();
let scriptCounter = 1;

function createScript({ script, leadName, companyName }) {
  const id = String(scriptCounter++);
  scripts.set(id, { script, leadName, companyName });
  return id;
}

function getScript(scriptId) {
  return scripts.get(scriptId) || null;
}

// ---------- Public API: start outbound calls ----------

// Apply strict rate limiting to call endpoints (10 calls/min)
app.post("/api/calls/start", strictLimiter, async (req, res) => {
  try {
    const { numbers, script, leadName, companyName } = req.body || {};

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res
        .status(400)
        .json({ error: "numbers must be a non-empty array" });
    }

    const scriptId = createScript({ script: script || "", leadName, companyName });

    const results = [];
    for (const raw of numbers) {
      const to = raw && String(raw).trim();
      if (!to) continue;

      const call = await createOutboundCall({ to, scriptId });
      initCall(call.sid, {
        script,
        leadName,
        companyName
      });
      results.push({
        callSid: call.sid,
        to: call.to,
        status: call.status
      });
    }

    res.json({ ok: true, scriptId, calls: results });
  } catch (err) {
    console.error("Error /api/calls/start:", err);
    res.status(500).json({ error: "Failed to start calls" });
  }
});

// ---------- Public API: list / get call state ----------

app.get("/api/calls", (req, res) => {
  res.json({ calls: listCalls() });
});

app.get("/api/calls/:callSid", (req, res) => {
  const call = getCall(req.params.callSid);
  if (!call) {
    return res.status(404).json({ error: "Call not found" });
  }
  res.json({ call });
});

// Traditional voice webhook (working but slower)
app.get("/api/twilio/voice", async (req, res) => {
  console.log("➡️  GET /api/twilio/voice hit for testing. Query:", req.query);

  const twiml = new twilio.twiml.VoiceResponse();

  // Simple test response
  const { script, voicePersona } = req.query;
  const greeting = script ? script.replace(/\{\{repName\}\}/g, voicePersona || 'Alex') : `Hello, this is ${voicePersona || 'Alex'} from Atomicwork.`;

  try {
    const audioUrl = await synthesizeTTS(greeting, 'test-call-sid');
    console.log(`[Test Greeting] Playing: ${audioUrl}`);
    twiml.play(audioUrl);
  } catch (err) {
    console.error("[Test Greeting] TTS failed:", err.message);
    twiml.say({ voice: "Polly.Joanna" }, greeting);
  }

  twiml.pause({ length: 0.5 });
  twiml.hangup();

  res.type("text/xml");
  res.send(twiml.toString());
});

// Realtime Voice TwiML - connects to OpenAI Realtime API via WebSocket
app.post("/api/twilio/voice-realtime", async (req, res) => {
  const callSid = req.body.CallSid;
  console.log(`[Realtime TwiML] Call ${callSid} connecting to realtime voice`);

  // Use PUBLIC_BASE_URL for WebSocket connection
  const publicUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
  const publicHost = publicUrl.replace('http://', '').replace('https://', '');

  // Use ws:// for http and wss:// for https
  const wsProtocol = publicUrl.startsWith('https://') ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://${publicHost}/ws-realtime-voice`;

  console.log(`[Realtime TwiML] WebSocket URL: ${wsUrl}`);

  const twiml = new twilio.twiml.VoiceResponse();
  const connect = twiml.connect();
  const stream = connect.stream({
    url: wsUrl,
  });

  res.type("text/xml");
  res.send(twiml.toString());
  console.log(`[Realtime TwiML] Sent TwiML for call ${callSid}`);
});

app.post("/api/twilio/voice", async (req, res) => {
  console.log(
    "➡️  /api/twilio/voice hit. CallSid:",
    req.body.CallSid,
    "callId:",
    req.query.callId
  );

  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.body.CallSid;
  const callId = req.query.callId;
  const customScript = req.query.script ? decodeURIComponent(req.query.script) : null;
  const voicePersona = req.query.voicePersona || 'Alex'; // Default rep name

  // Bridge metadata from the initiation request into call state (lead email, userId, region)
  const activeCall = callId ? getActiveCall(callId) : null;

  // CRITICAL: Always use Atomicwork as the company name for all calls
  // This platform is built for Atomicwork - all AI agents introduce as "XYZ from Atomicwork"
  const companyName = 'Atomicwork';

  // Extract first line/sentence from script as opening greeting
  // Use the voice persona name from activeCall - this comes from voice-rotation.js
  // which has proper gender-matched names (male voice = male name, female voice = female name)
  // The voicePersona from activeCall is set during call initiation with the correct gendered name
  const voiceName = (activeCall && activeCall.voicePersona) ? activeCall.voicePersona : null;
  // Fallback to query param voicePersona, or use 'Alex' as default (gender-neutral)
  const repName = voiceName || voicePersona || 'Alex';
  let openingScript = `Hi, this is ${repName} from ${companyName}. How are you doing today?`;
  if (customScript) {
    // Replace BOTH placeholders with actual values
    let processedScript = customScript
      .replace(/\{\{repName\}\}/gi, repName)
      .replace(/\{\{companyName\}\}/gi, companyName);

    // Take the first TWO sentences to ensure we get the "How are you?" part
    // Split on sentence boundaries but keep delimiters
    const sentences = processedScript.match(/[^.!?]+[.!?]+/g) || [processedScript];
    if (sentences.length >= 2) {
      // Take first two sentences
      openingScript = sentences.slice(0, 2).join(' ').trim();
    } else if (sentences.length === 1 && sentences[0].length > 10) {
      openingScript = sentences[0].trim();
    }
    // Ensure it's not too long for TTS (max 200 chars)
    if (openingScript.length > 200) {
      openingScript = openingScript.substring(0, 200);
    }
  }

  initCall(callSid, {
    script: (activeCall && activeCall.script) ? activeCall.script : (customScript || "Default sales script"),
    leadName: (activeCall && activeCall.leadName) ? activeCall.leadName : (req.query.leadName || "there"),
    companyName: "Atomicwork", // ALWAYS Atomicwork - this platform is for Atomicwork
    userId: (activeCall && activeCall.userId) ? activeCall.userId : null,
    voicePersona: (activeCall && activeCall.voicePersona) ? activeCall.voicePersona : voicePersona, // Use voice persona from initiation (gender-matched name)
    voiceId: (activeCall && activeCall.voiceId) ? String(activeCall.voiceId || '') : '' // CRITICAL FIX: Convert to string to prevent .substring() error
  });
  updateCall(callSid, { status: "in-progress" });

  if (activeCall) {
    updateCall(callSid, {
      leadEmail: activeCall.leadEmail || null,
      leadRegion: activeCall.region || null
    });
  }

  console.log(`[Script] Using opening: ${openingScript.substring(0, 80)}...`);

  // Play greeting with TTS (ElevenLabs with Polly fallback)
  // Pass region and voice ID for proper regional voice
  const leadRegion = activeCall ? activeCall.region : null;
  const voiceIdFromCall = activeCall ? activeCall.voiceId : null;
  try {
    const audioUrl = await synthesizeTTS(openingScript, callSid, voicePersona, leadRegion, voiceIdFromCall);
    console.log(`[Greeting] Playing: ${audioUrl}`);
    twiml.play(audioUrl);
  } catch (err) {
    console.error("[Greeting] TTS failed, using Polly:", err.message);
    twiml.say({ voice: "Polly.Joanna" }, openingScript);
  }

  twiml.pause({ length: 0.15 }); // Reduced from 0.2 for faster response

  // Gather with Enhanced Speech Model for better accuracy
  twiml.gather({
    input: "speech",
    action: "/api/twilio/handle-speech",
    method: "POST",
    timeout: 10, // Reduced from 12 for snappier response
    speechTimeout: "auto",
    speechModel: "phone_call",  // Enhanced model for phone calls
    enhanced: true,              // Enable enhanced speech recognition
    profanityFilter: false,
    language: "en-US"
  });

  // If no speech is captured, Twilio continues to the next verb.
  // Redirect back to handle-speech so we can reprompt without replaying the greeting.
  twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");

  res.type("text/xml");
  res.send(twiml.toString());
});

// ---------- Twilio Voice webhook: handle user speech ----------

app.post("/api/twilio/handle-speech", async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const callSid = req.body.CallSid;
    const speechResult = req.body.SpeechResult || "";
    const confidence = req.body.Confidence;

    console.log("========================================");
    console.log("[handle-speech] NEW REQUEST");
    console.log("[handle-speech] CallSid:", callSid);
    console.log("[handle-speech] Speech:", speechResult.substring(0, 100));
    console.log("[handle-speech] Confidence:", confidence);

    const call = await getCall(callSid); // Await is safer given async getCall
    if (!call) {
      console.error("[handle-speech] ❌ Call not found:", callSid);
      twiml.say({ voice: "Polly.Joanna" }, "Sorry, let me call you back. Bye!");
      twiml.hangup();
      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // NEW LOGGING
    console.log("[handle-speech] ✅ Call found:", {
      hasScript: !!call.script,
      hasUserId: !!call.userId,
      hasVoiceId: !!call.voiceId,
      voiceId: call.voiceId ? call.voiceId.substring(0, 8) + '...' : 'MISSING',
      transcriptLength: call.transcript?.length || 0,
      leadRegion: call.leadRegion
    });

    // Defensive check: Ensure critical fields exist
    if (!call.script) {
      console.error("[handle-speech] ❌ Call missing script field!");
      twiml.say({ voice: "Polly.Joanna" }, "I apologize, let me call you back in a moment. Thanks!");
      twiml.hangup();
      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // If Twilio posts back with no speech (silence/timeout), reprompt + listen again.
    if (!String(speechResult || "").trim()) {
      twiml.say({ voice: "Polly.Joanna" }, "Are you still there?");

      twiml.gather({
        input: "speech",
        action: "/api/twilio/handle-speech",
        method: "POST",
        timeout: 10,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });

      // Second reprompt + listen, then loop back here.
      try {
        const stillThereUrl2 = await synthesizeTTS("Are you still there?", callSid);
        twiml.play(stillThereUrl2);
      } catch (err) {
        twiml.pause({ length: 0.2 });
      }

      twiml.gather({
        input: "speech",
        action: "/api/twilio/handle-speech",
        method: "POST",
        timeout: 10,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });

      twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");
      res.type("text/xml");
      return res.send(twiml.toString());
    }

    if (speechResult) {
      addTranscript(callSid, { speaker: "prospect", text: speechResult });
    }

    const normalizedSpeech = String(speechResult || "").toLowerCase();

    const isOptOut =
      /\b(do not call|don't call|stop calling|remove me|take me off|unsubscribe|opt out)\b/i.test(normalizedSpeech);
    const isNotInterested =
      /\b(not interested|no thanks|no thank you|not a fit|not for me|not now|no i'?m not|no, i'?m not|i'?m not interested)\b/i.test(normalizedSpeech);

    // CRITICAL FIX: End call immediately when prospect says "not interested"
    // User feedback: AI kept talking after 3x "not interested" - absolutely unacceptable
    if (isOptOut || isNotInterested) {
      const closingLine = isOptOut
        ? "Understood — I'll take you off our list. Sorry for the interruption."
        : "I appreciate your time. Thanks for letting me know!";
      addTranscript(callSid, { speaker: "agent", text: closingLine });
      console.log(`[Objection Detected] ${isOptOut ? 'Opt-out' : 'Not interested'} - ending call immediately`);
      try {
        const audioUrl = await synthesizeTTS(closingLine, callSid);
        console.log(`[AI Reply] Playing: ${audioUrl}`);
        twiml.play(audioUrl);
      } catch {
        twiml.say({ voice: "Polly.Joanna" }, closingLine);
      }
      twiml.pause({ length: 0.5 });
      twiml.hangup();
      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // If we just asked to VERIFY an email on file, handle the response deterministically.
    if (call.leadEmail) {
      const lastAgentLine = [...(call.transcript || [])]
        .reverse()
        .find((t) => t && t.speaker === "agent" && typeof t.text === "string");

      const lastAskedToVerifyEmail =
        lastAgentLine && /have your email as/i.test(lastAgentLine.text);

      if (lastAskedToVerifyEmail) {
        const normalized = String(speechResult || "").toLowerCase();
        const confirmed = /\b(yes|yep|yeah|correct|that's correct|right|sure|exactly)\b/i.test(normalized);
        const denied = /\b(no|nope|wrong|not correct|that's not)\b/i.test(normalized);

        // Very lightweight email extraction from speech-to-text
        const candidate = normalized
          .replace(/\s+at\s+/g, "@")
          .replace(/\s+dot\s+/g, ".")
          .replace(/\s+/g, "")
          .trim();
        const containsEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(candidate);

        if (confirmed) {
          const closingLine = "Perfect — I'll send over some times. Talk soon!";
          addTranscript(callSid, { speaker: "agent", text: closingLine });
          try {
            const audioUrl = await synthesizeTTS(closingLine, callSid);
            console.log(`[AI Reply] Playing: ${audioUrl}`);
            twiml.play(audioUrl);
          } catch {
            twiml.say({ voice: "Polly.Joanna" }, closingLine);
          }
          twiml.pause({ length: 1.5 });
          twiml.hangup();
          res.type("text/xml");
          return res.send(twiml.toString());
        }

        if (denied || containsEmail) {
          const newEmail = containsEmail ? candidate : null;
          if (newEmail) {
            updateCall(callSid, { leadEmail: newEmail });
          }
          const usedEmail = newEmail || call.leadEmail;
          const closingLine = `Got it — I'll use ${usedEmail}. I'll send over some times. Talk soon!`;
          addTranscript(callSid, { speaker: "agent", text: closingLine });
          try {
            const audioUrl = await synthesizeTTS(closingLine, callSid);
            console.log(`[AI Reply] Playing: ${audioUrl}`);
            twiml.play(audioUrl);
          } catch {
            twiml.say({ voice: "Polly.Joanna" }, closingLine);
          }
          twiml.pause({ length: 1.5 });
          twiml.hangup();
          res.type("text/xml");
          return res.send(twiml.toString());
        }

        // Unclear response — restate the email we have and ask again.
        const reprompt = `Sorry — just confirming, is it ${call.leadEmail}?`;
        addTranscript(callSid, { speaker: "agent", text: reprompt });
        try {
          const audioUrl = await synthesizeTTS(reprompt, callSid);
          console.log(`[AI Reply] Playing: ${audioUrl}`);
          twiml.play(audioUrl);
        } catch {
          twiml.say({ voice: "Polly.Joanna" }, reprompt);
        }
        twiml.pause({ length: 0.3 });
        twiml.gather({
          input: "speech",
          action: "/api/twilio/handle-speech",
          method: "POST",
          timeout: 10,
          speechTimeout: "auto",
          speechModel: "phone_call",
          enhanced: true,
          profanityFilter: false,
          language: "en-US"
        });
        twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");
        res.type("text/xml");
        return res.send(twiml.toString());
      }
    }

    // Deterministic email verification when we already have it on file:
    // If the prospect just agreed to a meeting/demo and we have leadEmail, immediately verify it.
    const meetingIntentPositive =
      /\b(let'?s|lets)\b.*\b(meet|book|schedule)\b/i.test(speechResult) ||
      /\b(book|schedule)\b.*\b(time|demo|meeting|call)\b/i.test(speechResult) ||
      /\b(send)\b.*\b(times|slots)\b/i.test(speechResult) ||
      /\b(next week|monday|tuesday|wednesday|thursday|friday)\b.*\b(meet|demo|call)\b/i.test(speechResult) ||
      /\b(demo|meeting|call)\b.*\b(next week|monday|tuesday|wednesday|thursday|friday)\b/i.test(speechResult);
    const meetingIntentNegative =
      /\b(not interested|no thanks|don't want|do not want|dont want|not a fit|stop calling)\b/i.test(normalizedSpeech) &&
      /\b(demo|meeting|call|schedule|book)\b/i.test(normalizedSpeech);

    if (call.leadEmail && meetingIntentPositive && !meetingIntentNegative && call.transcript.length >= 6) {
      const verifyEmailLine = `Perfect! I have your email as ${call.leadEmail}—is that still the best one to reach you?`;
      addTranscript(callSid, { speaker: "agent", text: verifyEmailLine });
      try {
        const audioUrl = await synthesizeTTS(verifyEmailLine, callSid);
        console.log(`[AI Reply] Playing: ${audioUrl}`);
        twiml.play(audioUrl);
      } catch (err) {
        twiml.pause({ length: 0.2 });
      }

      twiml.pause({ length: 0.3 });
      twiml.gather({
        input: "speech",
        action: "/api/twilio/handle-speech",
        method: "POST",
        timeout: 10,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });

      // If Twilio doesn't capture speech, keep looping without replaying the greeting.
      twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");

      res.type("text/xml");
      return res.send(twiml.toString());
    }

    // Get AI reply with timeout protection (handled inside getAiSdrReply)
    // ========== PHASE 2: Pass knowledge context to AI ==========
    let reply;
    try {
      console.log("[AI] Requesting reply from OpenAI...");
      reply = await getAiSdrReply({
        script: call.script,
        transcript: call.transcript,
        latestUserText: speechResult,
        sttConfidence: Number(confidence || 0),
        userId: call.userId,
        leadEmail: call.leadEmail,
        leadRegion: call.leadRegion,
        voicePersona: call.voicePersona,
        companyName: call.companyName,
        // Pass knowledge context if available
        leadContext: call.leadContext || null,
        relevantKnowledge: call.relevantKnowledge || [],
        industry: call.industry || null,
        role: call.role || null
      });
      console.log("[AI] ✅ Reply received:", reply.substring(0, 100));
    } catch (aiError) {
      console.error("[AI] ❌ Error getting reply:", aiError.message);
      console.error("[AI] Stack:", aiError.stack);
      // Graceful fallback instead of technical difficulties
      reply = "I apologize, could you repeat that? I want to make sure I understand you correctly.";
      console.log("[AI] Using fallback reply");
    }
    // ========== END PHASE 2 ==========

    addTranscript(callSid, { speaker: "agent", text: reply });

    // Play AI reply with TTS (ElevenLabs with Polly fallback)
    // Pass region and voice ID for proper regional voice
    console.log("[TTS] Synthesizing with:", {
      voicePersona: call.voicePersona,
      voiceId: call.voiceId,
      region: call.leadRegion
    });

    try {
      const audioUrl = await synthesizeTTS(reply, callSid, call.voicePersona, call.leadRegion, call.voiceId);
      console.log(`[TTS] ✅ Audio generated: ${audioUrl.substring(0, 80)}`);
      twiml.play(audioUrl);
    } catch (ttsError) {
      console.error("[TTS] ❌ Synthesis failed:", ttsError.message);
      console.error("[TTS] Stack:", ttsError.stack);
      console.log("[TTS] Falling back to Polly.Joanna");
      twiml.say({ voice: "Polly.Joanna" }, reply);
    }

    // Check if this is a closing statement (thanks, goodbye, talk soon, etc.)
    // Be careful not to match "chat" or "good time to chat"
    const isClosing = /\b(thanks for your time|talk to you soon|have a great day|have a good day|have a wonderful day|looking forward to our call|appreciate your interest|goodbye|bye now|take care|speak soon|catch you later)\b/i.test(reply);

    // Also check if conversation has gone on too long (10+ exchanges)
    const conversationLength = call.transcript.length;
    // NEVER end call based on length - only end when prospect says goodbye
    // User requirement: System should not cut the call, only prospect can end it
    const shouldEnd = isClosing; // Removed length limit - calls continue until prospect ends

    if (shouldEnd) {
      // End the call gracefully after closing statement
      console.log(`[Call End] Closing detected (isClosing: ${isClosing}, length: ${conversationLength}), ending call gracefully`);
      twiml.pause({ length: 2 });
      twiml.hangup();
    } else {
      // Continue conversation
      twiml.pause({ length: 0.3 });

      // Gather next response with Enhanced Speech Model
      twiml.gather({
        input: "speech",
        action: "/api/twilio/handle-speech",
        method: "POST",
        timeout: 10,
        speechTimeout: "auto",
        speechModel: "phone_call",
        enhanced: true,
        profanityFilter: false,
        language: "en-US"
      });

      // Loop to avoid TwiML ending the call on repeated silence
      twiml.redirect({ method: "POST" }, "/api/twilio/handle-speech");
    }

    res.type("text/xml");
    res.send(twiml.toString());
  } catch (err) {
    console.error("========================================");
    console.error("[ERROR] ❌ handle-speech CRITICAL FAILURE");
    console.error("[ERROR] Message:", err.message);
    console.error("[ERROR] Stack:", err.stack);
    console.error("[ERROR] CallSid:", req.body.CallSid);
    console.error("========================================");

    // Graceful error recovery - don't mention "technical difficulties"
    twiml.say({ voice: "Polly.Joanna" }, "I apologize, could you repeat that one more time? I want to make sure I heard you correctly.");
    twiml.pause({ length: 0.5 });

    // Try to continue the conversation instead of hanging up
    twiml.gather({
      input: "speech",
      action: "/api/twilio/handle-speech",
      method: "POST",
      timeout: 10,
      speechTimeout: "auto",
      speechModel: "phone_call",
      enhanced: true,
      profanityFilter: false,
      language: "en-US"
    });

    // If still failing, then end gracefully
    twiml.say({ voice: "Polly.Joanna" }, "Thanks for your time. I'll follow up via email.");
    twiml.hangup();

    res.type("text/xml");
    res.send(twiml.toString());
  }
});

// ---------- Twilio Status Callback ----------

// Disconnect reason mapping
const DISCONNECT_REASONS = {
  'no-answer': 'No answer after 5 rings',
  'busy': 'Line busy',
  'failed': 'Call failed to connect',
  'canceled': 'Call was canceled',
  'voicemail': 'Reached voicemail - call ended automatically',
};

// AMD (Answering Machine Detection) Status Callback
app.post("/api/twilio/amd-status", async (req, res) => {
  const { CallSid, AnsweredBy, MachineDetectionDuration } = req.body;
  const callId = req.query.callId;

  console.log(`[AMD] CallSid=${CallSid}, AnsweredBy=${AnsweredBy}, Duration=${MachineDetectionDuration}ms`);

  // Track AMD event
  const activeCall = getActiveCall(callId);

  // If voicemail/machine detected, hang up immediately
  if (AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end_beep' ||
    AnsweredBy === 'machine_end_silence' ||
    AnsweredBy === 'fax') {

    console.log(`[AMD] Voicemail/machine detected for call ${callId}, hanging up`);

    // Add voicemail event
    if (activeCall && activeCall.callEvents) {
      activeCall.callEvents.push({
        event: 'voicemail',
        timestamp: new Date().toISOString(),
        details: '📠 Voicemail detected - hanging up automatically'
      });
      activeCall.disconnectReason = DISCONNECT_REASONS.voicemail;
    }

    // Update database with voicemail reason and check for drop
    if (callId) {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
      try {
        const vmRes = await fetch(`${FRONTEND_URL}/api/calls/${callId}/voicemail`, {
          method: 'POST',
        });

        if (vmRes.ok) {
          const vmData = await vmRes.json();
          if (vmData.dropped && vmData.audioUrl) {
            console.log(`[AMD] Dropping voicemail message: ${vmData.audioUrl}`);
            // Play voicemail using TwiML
            await twilioClient.calls(CallSid).update({
              twiml: `<Response><Play>${vmData.audioUrl}</Play><Hangup/></Response>`
            });
            return res.sendStatus(200);
          }
        }
      } catch (dbErr) {
        console.error('[AMD] Failed to check for voicemail drop:', dbErr);
      }

      // Fallback: just update status and hangup
      try {
        await fetch(`${FRONTEND_URL}/api/calls/${callId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: [],
            status: 'voicemail',
            disconnectReason: 'Voicemail (No Drop)',
            duration: 0
          })
        });
        await twilioClient.calls(CallSid).update({ status: 'completed' });
      } catch (e) {
        console.error('[AMD] Error ending call:', e);
      }
    } else {
      await twilioClient.calls(CallSid).update({ status: 'completed' });
    }
  } else if (AnsweredBy === 'human') {
    console.log(`[AMD] Human detected for call ${callId}, continuing call`);
    // Add human detected event
    if (activeCall && activeCall.callEvents) {
      activeCall.callEvents.push({
        event: 'human_detected',
        timestamp: new Date().toISOString(),
        details: '👤 Human answered - proceeding with conversation'
      });
    }
  }

  res.sendStatus(200);
});

app.post("/api/twilio/status", async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const callId = req.query.callId;
  const campaignId = req.query.campaignId;
  const callDuration = parseInt(req.body.CallDuration) || 0;
  const call = getCall(callSid);

  // Human-readable event messages
  const EVENT_MESSAGES = {
    'initiated': 'Call initiated',
    'ringing': '📞 Ringing... waiting for answer',
    'in-progress': '✅ Call answered - conversation started',
    'answered': '✅ Call answered',
    'completed': callDuration > 0 ? `Call completed (${callDuration}s)` : 'Call ended',
    'no-answer': '❌ No answer after 5 rings',
    'busy': '❌ Line busy',
    'failed': '❌ Call failed to connect',
    'canceled': '❌ Call canceled',
  };

  // Log all status updates
  console.log(`[Status] CallSid=${callSid}, Status=${callStatus}, Duration=${callDuration}s`);

  // Track event for both activeCalls and call state
  const eventMessage = EVENT_MESSAGES[callStatus] || callStatus;
  const newEvent = {
    event: callStatus,
    timestamp: new Date().toISOString(),
    details: eventMessage
  };

  // Update active call events (from initiate-call.js)
  const activeCall = getActiveCall(callId);
  if (activeCall) {
    if (activeCall.callEvents) {
      activeCall.callEvents.push(newEvent);
    }
    // Update status so frontend polling can detect disconnects
    activeCall.status = callStatus;
    if (['no-answer', 'busy', 'failed', 'canceled', 'completed'].includes(callStatus)) {
      activeCall.disconnectReason = DISCONNECT_REASONS[callStatus] || callStatus;
    }
  }

  if (!call) {
    // Still handle disconnect reasons even if call not in memory
    if (callId && ['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) {
      console.log(`[Status] Disconnect: ${callStatus} - ${DISCONNECT_REASONS[callStatus]}`);
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
      try {
        await fetch(`${FRONTEND_URL}/api/calls/${callId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: [],
            status: callStatus,
            disconnectReason: DISCONNECT_REASONS[callStatus] || callStatus,
            duration: 0
          })
        });
        console.log(`[Status] Disconnect reason saved for call ${callId}`);
      } catch (err) {
        console.error(`[Status] Failed to save disconnect reason:`, err.message);
      }
    }
    return res.sendStatus(200);
  }

  updateCall(callSid, { status: callStatus });

  // ===== HANDLE DISCONNECT REASONS (no-answer, busy, failed) =====
  if (['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) {
    console.log(`[Status] Call ${callSid} ended: ${DISCONNECT_REASONS[callStatus]}`);

    if (callId) {
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
      try {
        await fetch(`${FRONTEND_URL}/api/calls/${callId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: call.transcript || [],
            status: callStatus,
            disconnectReason: DISCONNECT_REASONS[callStatus],
            duration: 0
          })
        });
        console.log(`[Status] Disconnect reason saved for call ${callId}`);
      } catch (err) {
        console.error(`[Status] Failed to save disconnect reason:`, err.message);
      }
    }
  }

  // ===== AUTOMATED POST-CALL PROCESSING =====
  if (callStatus === "completed" && callDuration > 0) {
    console.log(`[Post-Call] Call ${callSid} completed. Processing transcript and summary...`);

    try {
      // Generate AI summary
      const summary = await summarizeCall({ transcript: call.transcript });
      updateCall(callSid, { summary });
      console.log(`[Post-Call] Summary generated: ${summary?.substring(0, 50)}...`);

      // Save transcript and summary to database via frontend API
      if (callId) {
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

        try {
          // Save transcript and summary to database
          const updateResponse = await fetch(`${FRONTEND_URL}/api/calls/${callId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript: call.transcript,
              summary: summary,
              duration: callDuration || Math.floor((Date.now() - new Date(call.createdAt).getTime()) / 1000),
              status: 'completed',
              disconnectReason: null, // Completed calls have no disconnect reason
              voicePersona: call.voicePersona || 'Arabella'
            })
          });

          if (updateResponse.ok) {
            console.log(`[Post-Call] ✅ Transcript and summary saved to database for call ${callId}`);
          } else {
            console.error(`[Post-Call] Failed to save to database:`, await updateResponse.text());
          }
        } catch (dbErr) {
          console.error(`[Post-Call] Error saving to database:`, dbErr.message);
        }
      }
    } catch (err) {
      console.error("Error summarizing call:", err);
    }
  }

  // Handle bulk campaign call completion
  if (campaignId && (callStatus === "completed" || callStatus === "failed" || callStatus === "busy" || callStatus === "no-answer")) {
    try {
      await handleCallComplete(callId, campaignId, callStatus);
    } catch (err) {
      console.error("Error handling bulk call completion:", err);
    }
  }

  res.sendStatus(200);
});

// ---------- Frontend Integration Routes ----------

// Initiate call from frontend
app.post("/api/twilio/initiate-call", initiateCall);

// Get call status
app.get("/api/calls/:callId/status", (req, res) => {
  const call = getActiveCall(req.params.callId);
  if (!call) {
    return res.status(404).json({ error: 'Call not found' });
  }
  res.json({
    status: call.status || 'active',
    transcript: call.transcript,
    duration: call.duration,
    callEvents: call.callEvents || [], // Timeline of call events
    disconnectReason: call.disconnectReason || null,
  });
});

// ---------- Bulk Calling Routes ----------

// Start a bulk calling campaign
app.post("/api/bulk-calls/start", async (req, res) => {
  try {
    const { campaignId, userId } = req.body;
    if (!campaignId || !userId) {
      return res.status(400).json({ error: 'Missing campaignId or userId' });
    }
    const result = await startCampaign(campaignId, userId);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('[BulkCall] Start error:', error);
    res.status(500).json({ error: 'Failed to start campaign' });
  }
});

// Control a bulk calling campaign (pause/resume/cancel)
app.post("/api/bulk-calls/control", async (req, res) => {
  try {
    const { campaignId, action } = req.body;
    if (!campaignId || !action) {
      return res.status(400).json({ error: 'Missing campaignId or action' });
    }
    const result = await controlCampaign(campaignId, action);
    res.json(result);
  } catch (error) {
    console.error('[BulkCall] Control error:', error);
    res.status(500).json({ error: 'Failed to control campaign' });
  }
});

// ========== SCALABILITY: Sentry Error Handler (must be after all routes) ==========
app.use(sentryErrorHandler());

// Generic error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ---------- Start server ----------

const server = app.listen(PORT, () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
});

// Attach WebSocket servers
attachRealtimeVoiceServer(server);
attachMediaStreamServer(server);
