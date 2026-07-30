"use client";

import { useState, FormEvent } from "react";

const textareaStyle = {
  width: "100%",
  minHeight: 160,
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.85rem",
  fontFamily: "monospace",
  resize: "vertical" as const,
};

export default function SslDecoderForm() {
  const [pem, setPem] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/tools/ssl-decoder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pem }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Request failed.");
      } else {
        setResult(data.output);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dash-panel">
      <form onSubmit={run} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="pem">PEM Certificate</label>
          <textarea
            id="pem"
            value={pem}
            onChange={(e) => setPem(e.target.value)}
            required
            placeholder={"-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----"}
            style={textareaStyle}
          />
        </div>
        <button className="submit" type="submit" disabled={loading} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          {loading ? "Decoding..." : "Decode"}
        </button>
      </form>

      {error && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {result && (
        <pre
          style={{
            marginTop: "1rem",
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
          {result}
        </pre>
      )}
    </div>
  );
}
