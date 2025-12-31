import twilio from 'twilio';
import { PrismaClient } from '@prisma/client';
import { getVoiceByLocation } from '../utils/voice-rotation.js';
import { researchCompany, formatCompanyKnowledge } from '../services/companyResearch.js';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:4000'; // Default to localhost for local dev
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

const prisma = new PrismaClient();

// Fallback phone numbers from env (used if DB lookup fails)
const FALLBACK_PHONES = {
  default: process.env.TWILIO_PHONE_NUMBER,
  anz: process.env.TWILIO_PHONE_NUMBER_ANZ || '+61341574513',
  in: process.env.TWILIO_PHONE_NUMBER_IN || process.env.TWILIO_PHONE_NUMBER, // India phone number
};

const client = twilio(accountSid, authToken);

// Store active calls
const activeCalls = new Map();

// Get phone number from database via Prisma (Direct DB Access)
async function getPhoneNumberFromDB(userId, region) {
  try {
    const normalizedRegion = region ? region.toUpperCase().trim() : null;

    // Direct match
    if (normalizedRegion) {
      const phone = await prisma.regionalPhoneNumber.findFirst({
        where: { userId, region: normalizedRegion }
      });
      if (phone) {
        console.log(`[Phone] DB lookup: ${phone.phoneNumber} for region ${phone.region}`);
        return phone.phoneNumber;
      }
    }

    // Pattern match (if direct failed)
    // Fetch all numbers for user to filter in memory (efficient for small lists)
    const allNumbers = await prisma.regionalPhoneNumber.findMany({
      where: { userId }
    });

    if (region && allNumbers.length > 0) {
      const regionLower = region.toLowerCase();
      const match = allNumbers.find(p => {
        const r = p.region.toLowerCase();
        return regionLower.includes(r) || r.includes(regionLower);
      });
      if (match) {
        console.log(`[Phone] DB fuzzy match via Prisma: ${match.phoneNumber} for region ${match.region}`);
        return match.phoneNumber;
      }
    }

    return null;
  } catch (err) {
    console.log(`[Phone] Prisma DB lookup failed:`, err.message);
  }
  return null;
}

// Get the appropriate phone number based on lead's region
async function getPhoneNumberForRegion(region, userId) {
  // Try database lookup first (if userId available)
  if (userId) {
    const dbPhone = await getPhoneNumberFromDB(userId, region);
    if (dbPhone) return dbPhone;
  }

  // Fallback to env vars
  if (!region) {
    console.log(`[Phone] Using default: ${FALLBACK_PHONES.default}`);
    return FALLBACK_PHONES.default;
  }

  const r = region.toLowerCase().trim();

  // India
  if (['india', 'in', 'indian'].some(x => r.includes(x))) {
    console.log(`[Phone] India fallback: ${FALLBACK_PHONES.in}`);
    return FALLBACK_PHONES.in;
  }

  // ANZ/Oceania
  if (['australia', 'au', 'aus', 'new zealand', 'nz', 'anz', 'oceania'].some(x => r.includes(x))) {
    console.log(`[Phone] ANZ fallback: ${FALLBACK_PHONES.anz}`);
    return FALLBACK_PHONES.anz;
  }

  console.log(`[Phone] Default: ${FALLBACK_PHONES.default}`);
  return FALLBACK_PHONES.default;
}

async function initiateCall(req, res) {
  try {
    const { callId, phoneNumber, script, leadName, leadEmail, leadCompany, region, leadId, industry, role, userId } = req.body;

    if (!callId || !phoneNumber || !script) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ========== PHASE 2: KNOWLEDGE-BASED LEAD RESEARCH ==========
    let leadContext = null;
    let personalizedScript = script;
    let relevantKnowledge = [];

    try {
      // Import lead research service
      const { researchLead, buildContextualSystemPrompt } = await import('../services/leadResearch.js');

      // Build lead object for research
      const lead = {
        id: leadId,
        userId: userId, // Pass userId for DB Lookups
        name: leadName,
        email: leadEmail,
        company: leadCompany || 'Unknown Company',
        industry: industry || region || 'Unknown',
        role: role || 'Unknown',
        phone: phoneNumber
      };

      console.log(`[Knowledge Research] Researching lead: ${leadName} at ${leadCompany}`);

      // Fetch seller themes from persona in DB
      let sellerThemes = [];
      let sellerDescription = '';

      if (userId) {
        try {
          // Look for persona type knowledge source
          const persona = await prisma.knowledgeSource.findFirst({
            where: { userId: userId, type: 'persona' }
          });

          if (persona) {
            try {
              // Try to parse content if it's JSON
              let data;
              try {
                data = JSON.parse(persona.content);
              } catch (e) {
                // Content might be plain text, use summary if available
                data = { description: persona.content };
              }

              if (data.product?.themes) {
                sellerThemes = data.product.themes;
              }
              if (data.product?.use_cases) {
                sellerThemes.push(...data.product.use_cases);
              }
              if (data.description) {
                sellerDescription = data.description;
              }

              console.log(`[Knowledge Research] Found ${sellerThemes.length} seller themes from persona`);
            } catch (parseError) {
              console.warn('Error parsing persona content:', parseError);
            }
          }
        } catch (dbError) {
          console.warn('Database error fetching persona:', dbError.message);
        }
      }

      // Research lead and get context - PASS SELLER THEMES AND PRISMA
      leadContext = await researchLead(lead, sellerDescription, sellerThemes, prisma);

      // Use personalized script if generated
      if (leadContext.personalizedScript) {
        personalizedScript = leadContext.personalizedScript;
        console.log(`[Knowledge Research] Using personalized script: ${personalizedScript.substring(0, 80)}...`);
      }

      relevantKnowledge = leadContext.relevantKnowledge || [];
      console.log(`[Knowledge Research] Found ${relevantKnowledge.length} relevant knowledge sources`);
      console.log(`[Knowledge Research] Generated ${leadContext.talkingPoints?.length || 0} talking points`);

    } catch (researchError) {
      console.error('[Knowledge Research] Error during lead research:', researchError);
      // Continue with call even if research fails
    }
    // ========== END PHASE 2 ==========

    // Select voice based on lead's region
    const selectedVoice = getVoiceByLocation(region);
    const voicePersona = selectedVoice.name; // Use voice name as persona
    const voiceId = selectedVoice.id;

    // Select phone number based on lead's region (from DB or env fallback)
    // removed duplicate userId declaration
    const fromNumber = await getPhoneNumberForRegion(region, userId);

    console.log(`[Initiate Call] Starting call to ${phoneNumber} for ${leadName}`);
    console.log(`[Initiate Call] Region: ${region || 'Not specified'}`);
    console.log(`[Initiate Call] From: ${fromNumber}`);
    console.log(`[Initiate Call] Voice: ${voicePersona} (${selectedVoice.gender}), ID: ${voiceId}`);
    console.log(`[Initiate Call] Script: ${personalizedScript.substring(0, 50)}...`);

    // Use company name from request or extract from script as fallback
    let companyName = leadCompany || 'Atomicwork'; // Use provided company or default
    if (!leadCompany) {
      // Fallback to extracting from script if not provided
      const companyMatch = personalizedScript.match(/(?:from|at)\s+([A-Z][A-Za-z0-9\s&]+?)(?:\.|,|\s+is|\s+Is|\n)/);
      if (companyMatch && companyMatch[1]) {
        companyName = companyMatch[1].trim();
        console.log(`[Initiate Call] Extracted company name from script: ${companyName}`);
      }
    } else {
      console.log(`[Initiate Call] Using provided company name: ${companyName}`);
    }

    // Store call metadata with events tracking AND knowledge context
    activeCalls.set(callId, {
      callId,
      phoneNumber,
      script: personalizedScript, // Use personalized script
      companyName, // Store extracted company
      voicePersona,
      voiceId, // Store the actual ElevenLabs voice ID
      leadName,
      leadEmail: leadEmail || null,
      region: region || null,
      startTime: new Date(),
      transcript: [],
      userId: req.body.userId || null,
      // ========== PHASE 2: Store knowledge context ==========
      leadContext: leadContext, // Full lead research context
      relevantKnowledge: relevantKnowledge, // Quick access to knowledge
      industry: industry || region || 'Unknown',
      role: role || 'Unknown',
      // ========== END PHASE 2 ==========
      // Track call events for UI display
      callEvents: [
        { event: 'initiated', timestamp: new Date().toISOString(), details: `Calling ${phoneNumber}` }
      ],
    });

    // Initiate Twilio call using traditional voice (WORKING - Media Stream has issues)
    const call = await client.calls.create({
      url: `${publicBaseUrl}/api/twilio/voice?callId=${callId}&voicePersona=${voicePersona}&companyName=${encodeURIComponent(leadCompany || 'our company')}`,
      to: phoneNumber,
      from: fromNumber, // Use region-specific phone number
      statusCallback: `${publicBaseUrl}/api/twilio/status?callId=${callId}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'no-answer', 'canceled', 'failed'],
      timeout: region === 'in' ? 45 : 30, // Longer timeout for international calls
      machineDetection: 'DetectMessageEnd', // Detect voicemail/answering machines
      asyncAmd: true, // Don't block on AMD detection
      asyncAmdStatusCallback: `${publicBaseUrl}/api/twilio/amd-status?callId=${callId}`, // AMD callback
      record: true,
      // Add international calling settings
      ...(region === 'in' && {
        // Additional settings for India calls
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'no-answer', 'canceled', 'failed']
      })
    });

    console.log(`[Initiate Call] Twilio call created: ${call.sid}`);

    // CRITICAL: Update call metadata with Twilio SID IMMEDIATELY before WebSocket connects
    const callData = activeCalls.get(callId);
    if (callData) {
      callData.twilioSid = call.sid;
      // Store by Twilio SID FIRST (WebSocket will use this)
      activeCalls.set(call.sid, callData);
      activeCalls.set(callId, callData);
      console.log(`[Initiate Call] Call stored by both callId=${callId} and twilioSid=${call.sid}`);

      // Register voice for this call in server.js
      const { setVoiceForCall } = await import('../server.js');
      setVoiceForCall(call.sid, voiceId);
    } else {
      console.error(`[Initiate Call] CRITICAL: callData not found for callId=${callId}`);
    }

    res.json({
      callSid: call.sid,
      status: call.status,
      callId,
    });
  } catch (error) {
    console.error('[Initiate Call] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

function getActiveCall(callId) {
  return activeCalls.get(callId);
}

function updateCallTranscript(callId, entry) {
  const call = activeCalls.get(callId);
  if (call) {
    call.transcript.push(entry);
    activeCalls.set(callId, call);
  }
}

function endCall(callId) {
  const call = activeCalls.get(callId);
  if (call) {
    call.endTime = new Date();
    call.duration = Math.floor((call.endTime - call.startTime) / 1000);
    activeCalls.set(callId, call);
  }
  return call;
}

async function retryFailedCall(callId, maxRetries = 3) {
  try {
    // Get call details from database
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const response = await fetch(`${FRONTEND_URL}/api/calls/${callId}`);
    if (!response.ok) {
      throw new Error('Call not found');
    }
    const callData = await response.json();

    if (callData.retryCount >= maxRetries) {
      throw new Error('Maximum retry attempts reached');
    }

    // Check if last status was a failure
    const lastStatus = callData.status;
    if (!['no-answer', 'busy', 'failed'].includes(lastStatus)) {
      throw new Error('Call does not need to be retried');
    }

    // Increment retry count and create new call
    const newCallId = crypto.randomUUID();
    const retryPayload = {
      callId: newCallId,
      phoneNumber: callData.lead.phone,
      script: callData.script.content,
      leadName: `${callData.lead.firstName} ${callData.lead.lastName}`.trim(),
      leadEmail: callData.lead.email || '',
      leadCompany: callData.companyName || callData.lead.company || 'Our Company',
      region: callData.region || 'us',
      userId: callData.userId,
      isRetry: true,
      originalCallId: callId
    };

    console.log(`[Retry] Retrying call ${callId} as ${newCallId} (attempt ${callData.retryCount + 1}/${maxRetries})`);

    // Initiate new call
    return await initiateCall({ body: retryPayload }, {
      json: (data) => ({ success: true, data }),
      status: (code) => ({ json: (data) => ({ success: false, data, code }) })
    });

  } catch (error) {
    console.error('[Retry] Error retrying call:', error);
    throw error;
  }
}

export {
  initiateCall,
  getActiveCall,
  updateCallTranscript,
  endCall,
  activeCalls,
  retryFailedCall
};
