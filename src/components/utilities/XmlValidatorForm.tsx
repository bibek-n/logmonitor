"use client";

import { useState } from "react";

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

// DOMParser never throws on malformed XML - it returns a document containing a
// <parsererror> element instead, so that's what we check for.
function validateXml(xml: string): { valid: boolean; message: string } {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    return { valid: false, message: parserError.textContent?.trim() ?? "Malformed XML." };
  }
  return { valid: true, message: prettyPrint(doc.documentElement, 0) };
}

function prettyPrint(node: Element, depth: number): string {
  const indent = "  ".repeat(depth);
  const children = Array.from(node.children);
  const textContent = Array.from(node.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent?.trim())
    .filter(Boolean)
    .join("");

  const attrs = Array.from(node.attributes)
    .map((a) => ` ${a.name}="${a.value}"`)
    .join("");

  if (children.length === 0) {
    return `${indent}<${node.tagName}${attrs}>${textContent}</${node.tagName}>`;
  }

  const childLines = children.map((c) => prettyPrint(c, depth + 1)).join("\n");
  return `${indent}<${node.tagName}${attrs}>\n${childLines}\n${indent}</${node.tagName}>`;
}

export default function XmlValidatorForm() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function validate() {
    setError(null);
    setPreview(null);
    if (!input.trim()) {
      setError("Paste some XML to validate.");
      return;
    }
    const result = validateXml(input);
    if (result.valid) {
      setPreview(result.message);
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="dash-panel">
      <div className="field" style={{ marginBottom: "0.9rem" }}>
        <label htmlFor="xml">XML</label>
        <textarea id="xml" value={input} onChange={(e) => setInput(e.target.value)} style={textareaStyle} spellCheck={false} />
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
          <div style={{ color: "var(--success)", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>Valid XML</div>
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
