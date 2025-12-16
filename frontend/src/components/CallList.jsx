import React, { useEffect, useState } from "react";
import { fetchCalls, fetchCall } from "../api";

export default function CallList() {
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [loadingCall, setLoadingCall] = useState(false);

  async function loadCalls() {
    try {
      const data = await fetchCalls();
      setCalls(data.calls || []);
    } catch (err) {
      console.error("Failed to load calls", err);
    }
  }

  useEffect(() => {
    loadCalls();
    const interval = setInterval(loadCalls, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handleSelectCall(callSid) {
    setLoadingCall(true);
    try {
      const data = await fetchCall(callSid);
      setSelectedCall(data.call);
    } catch (err) {
      console.error("Failed to load call details", err);
    } finally {
      setLoadingCall(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: "16px" }}>
      <div style={{ flex: 1 }}>
        <h2>Calls</h2>
        {calls.length === 0 && <p>No calls yet.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {calls.map((c) => (
            <li
              key={c.callSid}
              style={{
                border: "1px solid #ddd",
                padding: "8px",
                borderRadius: "6px",
                marginBottom: "8px",
                cursor: "pointer",
                background:
                  selectedCall && selectedCall.callSid === c.callSid
                    ? "#f0f0f0"
                    : "white"
              }}
              onClick={() => handleSelectCall(c.callSid)}
            >
              <div>
                <strong>{c.callSid}</strong>
              </div>
              <div>Status: {c.status}</div>
              <div>
                Created:{" "}
                {new Date(c.createdAt).toLocaleString(undefined, {
                  hour12: false
                })}
              </div>
              {c.summary && (
                <div style={{ marginTop: "4px", fontSize: "0.9em" }}>
                  <em>Interest: {c.summary.interest_level}</em>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ flex: 2 }}>
        <h2>Call Details</h2>
        {loadingCall && <p>Loading call...</p>}
        {!selectedCall && !loadingCall && <p>Select a call to view details.</p>}
        {selectedCall && !loadingCall && (
          <div
            style={{
              border: "1px solid #ddd",
              padding: "12px",
              borderRadius: "8px"
            }}
          >
            <h3>Call SID: {selectedCall.callSid}</h3>
            <p>Status: {selectedCall.status}</p>

            {selectedCall.summary && (
              <div
                style={{
                  border: "1px solid #eee",
                  padding: "8px",
                  borderRadius: "6px",
                  marginBottom: "8px"
                }}
              >
                <h4>Summary</h4>
                <p>Interest: {selectedCall.summary.interest_level}</p>
                <p>Objection: {selectedCall.summary.objection}</p>
                <p>Email: {selectedCall.summary.email || "N/A"}</p>
                <p>Next step: {selectedCall.summary.next_step}</p>
                <p>Notes: {selectedCall.summary.notes}</p>
              </div>
            )}

            <h4>Transcript</h4>
            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                border: "1px solid #eee",
                padding: "8px",
                borderRadius: "6px"
              }}
            >
              {selectedCall.transcript.length === 0 && (
                <p>No transcript yet.</p>
              )}
              {selectedCall.transcript.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: "6px"
                  }}
                >
                  <strong>
                    {t.speaker === "agent" ? "Agent" : "Prospect"}:
                  </strong>{" "}
                  {t.text}
                  <div
                    style={{
                      fontSize: "0.75em",
                      color: "#777"
                    }}
                  >
                    {new Date(t.timestamp).toLocaleTimeString(undefined, {
                      hour12: false
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
