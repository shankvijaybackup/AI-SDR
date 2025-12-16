import React, { useState } from "react";
import { startCalls } from "../api";

export default function CallForm({ onCallsStarted }) {
  const [numbers, setNumbers] = useState("");
  const [script, setScript] = useState(
    "Hi, this is Alex from Atomicwork. I was curious how you're currently handling IT service management and internal support for employees?"
  );
  const [leadName, setLeadName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const numbersArray = numbers
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);

      if (numbersArray.length === 0) {
        setError("Please enter at least one phone number.");
        setLoading(false);
        return;
      }

      const payload = {
        numbers: numbersArray,
        script,
        leadName,
        companyName
      };

      const data = await startCalls(payload);
      onCallsStarted(data.calls || []);
    } catch (err) {
      console.error(err);
      setError("Failed to start calls.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid #ddd",
        padding: "16px",
        borderRadius: "8px",
        marginBottom: "16px"
      }}
    >
      <h2>Start Outbound AI SDR Calls</h2>

      <label style={{ display: "block", marginTop: "8px" }}>
        Phone Numbers (one per line)
        <textarea
          value={numbers}
          onChange={(e) => setNumbers(e.target.value)}
          rows={4}
          style={{ width: "100%", marginTop: "4px" }}
          placeholder={"+1xxxxxxxxxx\n+61xxxxxxxxx"}
        />
      </label>

      <label style={{ display: "block", marginTop: "8px" }}>
        Lead Name (optional)
        <input
          type="text"
          value={leadName}
          onChange={(e) => setLeadName(e.target.value)}
          style={{ width: "100%", marginTop: "4px" }}
        />
      </label>

      <label style={{ display: "block", marginTop: "8px" }}>
        Company Name (optional)
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          style={{ width: "100%", marginTop: "4px" }}
        />
      </label>

      <label style={{ display: "block", marginTop: "8px" }}>
        Script / Pitch
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={4}
          style={{ width: "100%", marginTop: "4px" }}
        />
      </label>

      {error && (
        <div style={{ color: "red", marginTop: "8px" }}>{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{ marginTop: "12px", padding: "8px 16px" }}
      >
        {loading ? "Starting calls..." : "Start Calls"}
      </button>
    </form>
  );
}
