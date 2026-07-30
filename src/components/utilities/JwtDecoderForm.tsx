"use client";

import { useMemo, useState } from "react";

const textareaStyle = {
  width: "100%",
  minHeight: 120,
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.85rem",
  fontFamily: "monospace",
  resize: "vertical" as const,
};

const preStyle = {
  background: "var(--plane)",
  padding: "1rem",
  borderRadius: 8,
  overflowX: "auto" as const,
  fontSize: "0.82rem",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
  border: "1px solid var(--border)",
};

const TIME_CLAIMS = new Set(["exp", "iat", "nbf"]);

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/").padEnd(segment.length + ((4 - (segment.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function formatClaims(json: string): string {
  const parsed = JSON.parse(json);
  const annotated: Record<string, unknown> = { ...parsed };
  for (const claim of TIME_CLAIMS) {
    if (typeof parsed[claim] === "number") {
      annotated[`${claim}_readable`] = new Date(parsed[claim] * 1000).toISOString();
    }
  }
  return JSON.stringify(annotated, null, 2);
}

export default function JwtDecoderForm() {
  const [token, setToken] = useState("");

  const { header, payload, signature, error } = useMemo(() => {
    const trimmed = token.trim();
    if (!trimmed) return { header: null, payload: null, signature: null, error: null };

    const parts = trimmed.split(".");
    if (parts.length !== 3) {
      return { header: null, payload: null, signature: null, error: "A JWT must have 3 dot-separated parts (header.payload.signature)." };
    }

    try {
      const header = formatClaims(base64UrlDecode(parts[0]));
      const payload = formatClaims(base64UrlDecode(parts[1]));
      return { header, payload, signature: parts[2], error: null };
    } catch (err) {
      return { header: null, payload: null, signature: null, error: err instanceof Error ? err.message : "Failed to decode token." };
    }
  }, [token]);

  return (
    <div className="dash-panel">
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="jwt">JWT</label>
        <textarea
          id="jwt"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
          style={textareaStyle}
        />
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
        Decodes only - the signature is shown but not verified (verification requires knowing the signing algorithm and secret/key).
      </p>

      {error && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {header && payload && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginTop: "1rem" }}>
          <div>
            <strong style={{ fontSize: "0.85rem" }}>Header</strong>
            <pre style={{ ...preStyle, marginTop: "0.4rem" }}>{header}</pre>
          </div>
          <div>
            <strong style={{ fontSize: "0.85rem" }}>Payload</strong>
            <pre style={{ ...preStyle, marginTop: "0.4rem" }}>{payload}</pre>
          </div>
          <div>
            <strong style={{ fontSize: "0.85rem" }}>Signature (not verified)</strong>
            <pre style={{ ...preStyle, marginTop: "0.4rem" }}>{signature}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
