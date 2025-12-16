import React, { useState } from "react";
import CallForm from "./components/CallForm.jsx";
import CallList from "./components/CallList.jsx";

export default function App() {
  const [startedCalls, setStartedCalls] = useState([]);

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "16px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      <h1>AI SDR Outbound Caller</h1>
      <p style={{ color: "#555" }}>
        Lightweight outbound AI SDR. Enter numbers, a script, and let the AI
        handle the conversation.
      </p>

      <CallForm onCallsStarted={setStartedCalls} />

      {startedCalls.length > 0 && (
        <div
          style={{
            marginBottom: "16px",
            padding: "8px",
            border: "1px solid #eee",
            borderRadius: "6px"
          }}
        >
          <strong>Calls started:</strong>{" "}
          {startedCalls.map((c) => c.callSid).join(", ")}
        </div>
      )}

      <CallList />
    </div>
  );
}
