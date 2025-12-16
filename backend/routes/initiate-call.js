import twilio from 'twilio';
import { getVoiceByLocation } from '../utils/voice-rotation.js';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const publicBaseUrl = process.env.PUBLIC_BASE_URL;

const client = twilio(accountSid, authToken);

// Store active calls
const activeCalls = new Map();

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

    console.log(`[Initiate Call] Starting call to ${phoneNumber} for ${leadName}`);
    console.log(`[Initiate Call] Region: ${region || 'Not specified'}`);
    console.log(`[Initiate Call] Voice: ${voicePersona} (${selectedVoice.gender}), ID: ${voiceId}`);
    console.log(`[Initiate Call] Script: ${script.substring(0, 50)}...`);

    // Store call metadata
    activeCalls.set(callId, {
      callId,
      phoneNumber,
      script,
      voicePersona,
      voiceId, // Store the actual ElevenLabs voice ID
      leadName,
      leadEmail: leadEmail || null,
      startTime: new Date(),
      transcript: [],
      userId: req.body.userId || null,
    });

    // Initiate Twilio call using traditional voice (WORKING - Media Stream has issues)
    const call = await client.calls.create({
      url: `${publicBaseUrl}/api/twilio/voice?callId=${callId}&voicePersona=${voicePersona}&script=${encodeURIComponent(script)}`,
      to: phoneNumber,
      from: twilioPhoneNumber,
      statusCallback: `${publicBaseUrl}/api/twilio/status?callId=${callId}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
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
