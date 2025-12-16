// routes/voice-realtime.js - Twilio Voice webhook for Realtime API
import twilio from 'twilio';

const publicBaseUrl = process.env.PUBLIC_BASE_URL;

/**
 * Twilio Voice webhook - connects call to Realtime WebSocket
 */
export function voiceRealtimeWebhook(req, res) {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.query.CallSid || req.body.CallSid;
  const callId = req.query.callId;
  const voicePersona = req.query.voicePersona || 'female';
  const script = req.query.script || '';
  const leadName = req.query.leadName || '';

  console.log(`[Voice Realtime] CallSid: ${callSid}, CallId: ${callId}, Lead: ${leadName}`);
  console.log(`[Voice Realtime] Connecting to WebSocket...`);

  // Connect to WebSocket for bidirectional audio streaming
  const connect = twiml.connect();
  connect.stream({
    url: `wss://${publicBaseUrl.replace('https://', '').replace('http://', '')}/twilio-realtime-voice`,
    parameters: {
      callId: callId,
      callSid: callSid,
      voicePersona: voicePersona,
      leadName: leadName
    }
  });

  console.log(`[Voice Realtime] TwiML response sent`);

  res.type('text/xml');
  res.send(twiml.toString());
}
