"use client";

import { useState } from "react";
import { load, YAMLException } from "js-yaml";

const textareaStyle = {
  width: "100%",
  minHeight: 220,
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.85rem",
  fontFamily: "monospace",
  resize: "vertical" as const,
};

export default function YamlValidatorForm() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function validate() {
    setError(null);
    setPreview(null);
    if (!input.trim()) {
      setError("Paste some YAML to validate.");
      return;
    }
    try {
      const parsed = load(input);
      setPreview(JSON.stringify(parsed, null, 2));
    } catch (err) {
      if (err instanceof YAMLException) {
        setError(`Line ${(err.mark?.line ?? 0) + 1}, column ${(err.mark?.column ?? 0) + 1}: ${err.reason}`);
      } else {
        setError(err instanceof Error ? err.message : "Invalid YAML.");
      }
    }
  }

  return (
    <div className="dash-panel">
      <div className="field" style={{ marginBottom: "0.9rem" }}>
        <label htmlFor="yaml">YAML</label>
        <textarea id="yaml" value={input} onChange={(e) => setInput(e.target.value)} style={textareaStyle} spellCheck={false} />
      </div>

      <button className="submit" type="button" onClick={validate} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
        Validate
      </button>

      {error && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {preview && (
        <div style={{ marginTop: "1rem" }}>
          <div style={{ color: "var(--success)", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>Valid YAML</div>
          <pre
            style={{
              background: "var(--plane)",
              padding: "1rem",
              borderRadius: 8,
              overflowX: "auto",
              fontSize: "0.82rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              border: "1px solid var(--border)",
            }}
          >
            {preview}
          </pre>
        </div>
      )}
    </div>
  );
}
