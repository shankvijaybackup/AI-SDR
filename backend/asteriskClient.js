// asteriskClient.js
import AmiClient from "asterisk-ami-client";

const client = new AmiClient({
  reconnect: true,
  keepAlive: true,
  emitEventsByTypes: true,
  emitResponsesById: true
});

const AMI_USER = "admin";
const AMI_PASS = "admin_secret";
const HOST = "localhost";
const PORT = 5038;

let isConnected = false;

export function connectAsterisk() {
  client.connect(AMI_USER, AMI_PASS, { host: HOST, port: PORT })
    .then(() => {
      console.log("✅ Connected to Asterisk AMI");
      isConnected = true;
    })
    .catch((err) => {
      console.error("❌ Asterisk AMI connection failed:", err);
    });
    
  client.on("event", (event) => {
    // Handle events like Hangup, Newchannel, etc.
    // console.log("AMI Event:", event);
  });
}

/**
 * Trigger an outbound call via Asterisk.
 * Leg 1: The Prospect (PJSIP/endpoint)
 * Leg 2: The Internal Context (where AI lives)
 */
export async function createAsteriskCall({ to, scriptId }) {
  if (!isConnected) {
    throw new Error("Asterisk AMI not connected");
  }
  
  // Format: PJSIP/<number>@callwithus
  // Ensure 'to' is clean numbers
  const channel = `PJSIP/${to}@callwithus`;
  
  // Unique ID for tracking
  const actionId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  
  // Originate action
  // This calls the 'Channel' first. When answered, it goes to 'Context'/'Exten'.
  return new Promise((resolve, reject) => {
    client.action({
      Action: "Originate",
      Channel: channel,
      Context: "outbound-ai",
      Exten: "start",
      Priority: 1,
      Async: true,
      Variable: `SCRIPT_ID=${scriptId}`,
      CallerID: "AI SDR <0000000000>", // Set your caller ID here
      ActionID: actionId
    }, (err, res) => {
      if (err) return reject(err);
      resolve({ sid: actionId, status: "queued" });
    });
  });
}
