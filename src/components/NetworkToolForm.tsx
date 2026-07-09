"use client";

import { useState, FormEvent } from "react";

interface Props {
  endpoint: string;
  targetLabel: string;
  targetPlaceholder: string;
  recordTypes?: string[];
  showServerField?: boolean;
}

const inputStyle = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.95rem",
};

export default function NetworkToolForm({ endpoint, targetLabel, targetPlaceholder, recordTypes, showServerField }: Props) {
  const [target, setTarget] = useState("");
  const [recordType, setRecordType] = useState(recordTypes?.[0] ?? "A");
  const [server, setServer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim(), recordType, server: server.trim() || undefined }),
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
      <form onSubmit={run} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
          <label htmlFor="target">{targetLabel}</label>
          <input
            id="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
            placeholder={targetPlaceholder}
          />
        </div>
        {recordTypes && (
          <div className="field" style={{ marginBottom: 0, flex: "0 1 140px" }}>
            <label htmlFor="recordType">Record Type</label>
            <select id="recordType" value={recordType} onChange={(e) => setRecordType(e.target.value)} style={inputStyle}>
              {recordTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
        {showServerField && (
          <div className="field" style={{ marginBottom: 0, flex: "1 1 220px" }}>
            <label htmlFor="server">DNS Server (optional)</label>
            <input
              id="server"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="default: system resolver, e.g. 8.8.8.8"
            />
          </div>
        )}
        <button className="submit" type="submit" disabled={loading} style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
          {loading ? "Running..." : "Run"}
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
