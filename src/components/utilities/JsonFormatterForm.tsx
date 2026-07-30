"use client";

import { useState } from "react";

const textareaStyle = {
  width: "100%",
  minHeight: 260,
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

export default function JsonFormatterForm() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState<string | null>(null);

  function format() {
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, indent === 0 ? "\t" : indent));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON.");
    }
  }

  function minify() {
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON.");
    }
  }

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "0.9rem" }}>
        <div className="field" style={{ marginBottom: 0, flex: "0 1 140px" }}>
          <label htmlFor="indent">Indent</label>
          <select id="indent" value={indent} onChange={(e) => setIndent(Number(e.target.value))} style={selectStyle}>
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
            <option value={0}>Tab</option>
          </select>
        </div>
        <button className="submit" type="button" onClick={format} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          Format
        </button>
        <button className="submit" type="button" onClick={minify} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          Minify
        </button>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: "0.9rem" }}>
          {error}
        </div>
      )}

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="json">JSON</label>
        <textarea id="json" value={input} onChange={(e) => setInput(e.target.value)} style={textareaStyle} spellCheck={false} />
      </div>
    </div>
  );
}
