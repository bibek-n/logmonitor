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
  fontSize: "0.9rem",
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

type Mode = "encodeComponent" | "decodeComponent" | "encodeUri" | "decodeUri";

const MODE_LABELS: Record<Mode, string> = {
  encodeComponent: "Encode (component)",
  decodeComponent: "Decode (component)",
  encodeUri: "Encode (full URI)",
  decodeUri: "Decode (full URI)",
};

function run(mode: Mode, input: string): string {
  switch (mode) {
    case "encodeComponent":
      return encodeURIComponent(input);
    case "decodeComponent":
      return decodeURIComponent(input);
    case "encodeUri":
      return encodeURI(input);
    case "decodeUri":
      return decodeURI(input);
  }
}

export default function UrlEncoderDecoderForm() {
  const [mode, setMode] = useState<Mode>("encodeComponent");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleRun() {
    setError(null);
    try {
      setOutput(run(mode, input));
    } catch (err) {
      setOutput("");
      setError(err instanceof Error ? err.message : "Invalid input for this operation.");
    }
  }

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "0.9rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="mode">Mode</label>
          <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={selectStyle}>
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <button className="submit" type="button" onClick={handleRun} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          Run
        </button>
      </div>

      <div className="field" style={{ marginBottom: "0.9rem" }}>
        <label htmlFor="input">Input</label>
        <textarea id="input" value={input} onChange={(e) => setInput(e.target.value)} style={textareaStyle} />
      </div>

      {error && <div className="error">{error}</div>}

      {output && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="output">Output</label>
          <textarea id="output" value={output} readOnly style={textareaStyle} />
        </div>
      )}
    </div>
  );
}
