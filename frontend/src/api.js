const BASE_URL = "http://localhost:4000";

export async function startCalls(payload) {
  const res = await fetch(`${BASE_URL}/api/calls/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error("Failed to start calls");
  }
  return res.json();
}

export async function fetchCalls() {
  const res = await fetch(`${BASE_URL}/api/calls`);
  if (!res.ok) throw new Error("Failed to fetch calls");
  return res.json();
}

export async function fetchCall(callSid) {
  const res = await fetch(`${BASE_URL}/api/calls/${callSid}`);
  if (!res.ok) throw new Error("Failed to fetch call");
  return res.json();
}
