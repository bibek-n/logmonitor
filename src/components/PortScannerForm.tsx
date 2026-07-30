"use client";

import { useState, FormEvent } from "react";

const inputStyle = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.95rem",
};

export default function PortScannerForm() {
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState<"internal" | "external">("internal");
  const [protocol, setProtocol] = useState<"tcp" | "udp">("tcp");
  const [preset, setPreset] = useState<"top20" | "common" | "custom">("top20");
  const [customPorts, setCustomPorts] = useState("");
  const [grabBanners, setGrabBanners] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/tools/port-scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: target.trim(),
          category,
          protocol,
          preset,
          customPorts: preset === "custom" ? customPorts.trim() : undefined,
          grabBanners,
        }),
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
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
            <label htmlFor="target">Target</label>
            <input
              id="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              placeholder="e.g. 192.168.1.1 or a public IP/hostname"
            />
          </div>

          <div className="field" style={{ marginBottom: 0, flex: "0 1 160px" }}>
            <label htmlFor="category">Category</label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value as "internal" | "external")} style={inputStyle}>
              <option value="internal">Internal</option>
              <option value="external">External</option>
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0, flex: "0 1 140px" }}>
            <label htmlFor="protocol">Protocol</label>
            <select id="protocol" value={protocol} onChange={(e) => setProtocol(e.target.value as "tcp" | "udp")} style={inputStyle}>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0, flex: "0 1 180px" }}>
            <label htmlFor="preset">Ports</label>
            <select id="preset" value={preset} onChange={(e) => setPreset(e.target.value as "top20" | "common" | "custom")} style={inputStyle}>
              <option value="top20">Top 20</option>
              <option value="common">Common (~30)</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <button className="submit" type="submit" disabled={loading} style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
            {loading ? "Scanning..." : "Scan"}
          </button>
        </div>

        {preset === "custom" && (
          <div className="field" style={{ marginBottom: 0, maxWidth: 420 }}>
            <label htmlFor="customPorts">Custom ports/ranges</label>
            <input
              id="customPorts"
              value={customPorts}
              onChange={(e) => setCustomPorts(e.target.value)}
              placeholder="e.g. 22,80,443,8000-8100"
              required
            />
          </div>
        )}

        {protocol === "tcp" && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
            <input type="checkbox" checked={grabBanners} onChange={(e) => setGrabBanners(e.target.checked)} />
            Grab banners on open ports
          </label>
        )}
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
