"use client";

import { useState } from "react";

const textareaStyle = {
  width: "100%",
  minHeight: 140,
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.85rem",
  fontFamily: "monospace",
  resize: "vertical" as const,
};

const selectStyle = {
  padding: "0.5rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.9rem",
};

function encodeBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function decodeBase64(input: string): string {
  const binary = atob(input.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export default function Base64ToolForm() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    try {
      setOutput(mode === "encode" ? encodeBase64(input) : decodeBase64(input));
    } catch (err) {
      setOutput("");
      setError(err instanceof Error ? `Invalid Base64 input: ${err.message}` : "Invalid Base64 input.");
    }
  }

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "0.9rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="mode">Mode</label>
          <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as "encode" | "decode")} style={selectStyle}>
            <option value="encode">Encode</option>
            <option value="decode">Decode</option>
          </select>
        </div>
        <button className="submit" type="button" onClick={run} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          Run
        </button>
      </div>

      <div className="field" style={{ marginBottom: "0.9rem" }}>
        <label htmlFor="input">{mode === "encode" ? "Text" : "Base64"}</label>
        <textarea id="input" value={input} onChange={(e) => setInput(e.target.value)} style={textareaStyle} />
      </div>

      {error && <div className="error">{error}</div>}

      {output && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="output">{mode === "encode" ? "Base64" : "Text"}</label>
          <textarea id="output" value={output} readOnly style={textareaStyle} />
        </div>
      )}
    </div>
  );
}
