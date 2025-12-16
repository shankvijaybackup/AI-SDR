// twilioClient.js
import twilio from "twilio";

// Read raw env values
const rawSid = process.env.TWILIO_ACCOUNT_SID || "";
const rawToken = process.env.TWILIO_AUTH_TOKEN || "";
const rawFrom = process.env.TWILIO_PHONE_NUMBER || "";
const rawBaseUrl = process.env.PUBLIC_BASE_URL || "";

// Trim to remove any hidden whitespace/newlines
const TWILIO_ACCOUNT_SID = rawSid.trim();
const TWILIO_AUTH_TOKEN = rawToken.trim();
const TWILIO_PHONE_NUMBER = rawFrom.trim();
const PUBLIC_BASE_URL = rawBaseUrl.replace(/\/+$/, ""); // drop trailing slashes

// Debug logs (safe: no token printed)
console.log("Twilio env check → SID:", TWILIO_ACCOUNT_SID);
console.log("Twilio env check → TOKEN present?", !!TWILIO_AUTH_TOKEN);
console.log(
  "Twilio env check → TOKEN length:",
  TWILIO_AUTH_TOKEN ? TWILIO_AUTH_TOKEN.length : 0
);
console.log("Twilio env check → FROM number:", TWILIO_PHONE_NUMBER);
console.log("Twilio env check → PUBLIC_BASE_URL:", PUBLIC_BASE_URL);

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
  console.warn("⚠️ Twilio SID / Auth Token / From number missing from env!");
}

// Create Twilio REST client
export const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Self-test Twilio client at startup (same as your curl did)
twilioClient.api.accounts
  .list({ limit: 1 })
  .then(() => console.log("Twilio client test: OK ✅"))
  .catch((err) => {
    console.error("Twilio client test FAILED ❌", {
      status: err.status,
      code: err.code,
      message: err.message,
      moreInfo: err.moreInfo
    });
  });

/**
 * Create an outbound call to a given number.
 * Twilio will hit /api/twilio/voice when the call is answered.
 */
export async function createOutboundCall({ to, scriptId }) {
  if (!PUBLIC_BASE_URL) {
    throw new Error(
      "PUBLIC_BASE_URL is required so Twilio can reach your webhook"
    );
  }

  const url = `${PUBLIC_BASE_URL}/api/twilio/voice?scriptId=${encodeURIComponent(
    scriptId
  )}`;

  const call = await twilioClient.calls.create({
    to,
    from: TWILIO_PHONE_NUMBER,
    url,
    statusCallback: `${PUBLIC_BASE_URL}/api/twilio/status`,
    statusCallbackMethod: "POST",
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"]
  });

  return call;
}