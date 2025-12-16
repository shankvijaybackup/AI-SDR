// routes/voice-media-stream.js - Twilio Voice webhook for Media Streams
import twilio from 'twilio';

const publicBaseUrl = process.env.PUBLIC_BASE_URL;

/**
 * Twilio Voice webhook - connects call to Media Stream WebSocket
 * This uses Deepgram STT + OpenAI + ElevenLabs TTS for lower latency
 */
export function voiceMediaStreamWebhook(req, res) {
  const twiml = new twilio.twiml.VoiceResponse();
  const callSid = req.query.CallSid || req.body.CallSid;
  const callId = req.query.callId;
  const voicePersona = req.query.voicePersona || 'female';
  const script = req.query.script || '';
  const leadName = req.query.leadName || '';

  console.log(`[Voice Media Stream] CallSid: ${callSid}, CallId: ${callId}, Lead: ${leadName}`);

  // Connect to Media Stream WebSocket for bidirectional audio (no Polly greeting)
  const connect = twiml.connect();
  connect.stream({
    url: `wss://${publicBaseUrl.replace('https://', '').replace('http://', '')}/twilio-media-stream`
  });

  console.log(`[Voice Media Stream] TwiML sent - connecting to WebSocket`);

  res.type('text/xml');
  res.send(twiml.toString());
}
