import twilio from 'twilio';
import { getVoiceByLocation } from '../utils/voice-rotation.js';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const publicBaseUrl = process.env.PUBLIC_BASE_URL;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

// Fallback phone numbers from env (used if DB lookup fails)
const FALLBACK_PHONES = {
  default: process.env.TWILIO_PHONE_NUMBER,
  anz: process.env.TWILIO_PHONE_NUMBER_ANZ || '+61341574513',
};

const client = twilio(accountSid, authToken);

// Store active calls
const activeCalls = new Map();

// Get phone number from database via API
async function getPhoneNumberFromDB(userId, region) {
  try {
    const url = `${frontendUrl}/api/settings/phone-numbers/lookup?userId=${userId}&region=${encodeURIComponent(region || '')}`;
    const response = await fetch(url, { timeout: 3000 });
    if (response.ok) {
      const data = await response.json();
      if (data.phoneNumber) {
        console.log(`[Phone] DB lookup: ${data.phoneNumber} for region ${data.region}`);
        return data.phoneNumber;
      }
    }
  } catch (err) {
    console.log(`[Phone] DB lookup failed, using fallback:`, err.message);
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
    const { callId, phoneNumber, script, leadName, leadEmail, region } = req.body;

    if (!callId || !phoneNumber || !script) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Select voice based on lead's region
    const selectedVoice = getVoiceByLocation(region);
    const voicePersona = selectedVoice.name; // Use voice name as persona
    const voiceId = selectedVoice.id;

    // Select phone number based on lead's region (from DB or env fallback)
    const userId = req.body.userId || null;
    const fromNumber = await getPhoneNumberForRegion(region, userId);

    console.log(`[Initiate Call] Starting call to ${phoneNumber} for ${leadName}`);
    console.log(`[Initiate Call] Region: ${region || 'Not specified'}`);
    console.log(`[Initiate Call] From: ${fromNumber}`);
    console.log(`[Initiate Call] Voice: ${voicePersona} (${selectedVoice.gender}), ID: ${voiceId}`);
    console.log(`[Initiate Call] Script: ${script.substring(0, 50)}...`);

    // Store call metadata with events tracking
    activeCalls.set(callId, {
      callId,
      phoneNumber,
      script,
      voicePersona,
      voiceId, // Store the actual ElevenLabs voice ID
      leadName,
      leadEmail: leadEmail || null,
      region: region || null,
      startTime: new Date(),
      transcript: [],
      userId: req.body.userId || null,
      // Track call events for UI display
      callEvents: [
        { event: 'initiated', timestamp: new Date().toISOString(), details: `Calling ${phoneNumber}` }
      ],
    });

    // Initiate Twilio call using traditional voice (WORKING - Media Stream has issues)
    const call = await client.calls.create({
      url: `${publicBaseUrl}/api/twilio/voice?callId=${callId}&voicePersona=${voicePersona}&script=${encodeURIComponent(script)}`,
      to: phoneNumber,
      from: fromNumber, // Use region-specific phone number
      statusCallback: `${publicBaseUrl}/api/twilio/status?callId=${callId}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'no-answer', 'canceled', 'failed'],
      timeout: 30, // Disconnect after ~5 rings (30 seconds)
      machineDetection: 'DetectMessageEnd', // Detect voicemail/answering machines
      asyncAmd: true, // Don't block on AMD detection
      asyncAmdStatusCallback: `${publicBaseUrl}/api/twilio/amd-status?callId=${callId}`, // AMD callback
      record: true,
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

export {
  initiateCall,
  getActiveCall,
  updateCallTranscript,
  endCall,
  activeCalls
};
