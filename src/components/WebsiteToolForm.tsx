"use client";

import { useState, FormEvent } from "react";

interface SavedWebsite {
  Id: number;
  Name: string;
  Url: string;
}

interface Props {
  endpoint: string;
  savedWebsites: SavedWebsite[];
}

export default function WebsiteToolForm({ endpoint, savedWebsites }: Props) {
  const [url, setUrl] = useState("");
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
        body: JSON.stringify({ url: url.trim() }),
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
        {savedWebsites.length > 0 && (
          <div className="field" style={{ marginBottom: 0, flex: "1 1 220px" }}>
            <label htmlFor="saved">Saved Website</label>
            <select
              id="saved"
              onChange={(e) => {
                const site = savedWebsites.find((w) => String(w.Id) === e.target.value);
                if (site) setUrl(site.Url);
              }}
              defaultValue=""
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--plane)",
                color: "var(--ink)",
                fontSize: "0.95rem",
              }}
            >
              <option value="">-- choose a saved website --</option>
              {savedWebsites.map((w) => (
                <option key={w.Id} value={w.Id}>
                  {w.Name} ({w.Url})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
          <label htmlFor="url">Website URL</label>
          <input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://example.com"
          />
        </div>
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
