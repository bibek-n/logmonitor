"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";

interface SavedWebsite {
  Id: number;
  Name: string;
  Url: string;
}

interface Report {
  targetUrl: string;
  finalUrl: string;
  ipAddress: string | null;
  statusCode: number;
  headers: Record<string, string>;
  present: string[];
  missing: string[];
  grade: string;
  score: number;
  coreHeaders: string[];
  upcomingHeaders: string[];
  scannedAt: string;
}

interface HistoryRow {
  Id: number;
  TargetUrl: string;
  IpAddress: string | null;
  Grade: string;
  Score: number;
  TriggeredByUsername: string | null;
  ScannedAt: string;
}

// Duplicated (rather than imported) from src/lib/securityHeaders.ts: that module imports
// node:dns/promises at the top level, which can't be bundled into client code, so this
// client component keeps its own copy of just the plain-language descriptions.
const HEADER_INFO: Record<string, string> = {
  "x-content-type-options":
    'Stops the browser from trying to MIME-sniff the content type and forces it to stick with the declared Content-Type. The only valid value is "nosniff".',
  "x-frame-options": "Tells the browser whether this site can be loaded inside a frame. Restricting framing defends against clickjacking attacks.",
  "content-security-policy":
    "An effective defense against XSS attacks — by allow-listing approved sources of content, it stops the browser from loading malicious or unexpected assets.",
  "strict-transport-security":
    "Strengthens TLS by instructing browsers to always reach this site over HTTPS, even if a user types or links to a plain http:// URL.",
  "referrer-policy": "Controls how much information the browser includes in the Referer header when navigating away from this site.",
  "permissions-policy": "Lets a site control which browser features and APIs (camera, geolocation, microphone, etc.) can be used on the page.",
  "cross-origin-embedder-policy": "Prevents this page from loading cross-origin resources that don't explicitly grant it permission via CORS or CORP.",
  "cross-origin-opener-policy": "Lets a site opt into cross-origin isolation in the browser, separating its browsing context from cross-origin documents.",
  "cross-origin-resource-policy": "Lets a resource owner declare which origins are allowed to load that resource.",
  "report-to": "Enables the Reporting API, letting the browser send this site reports about deprecations, CSP violations, and other errors it encounters.",
  nel: "Network Error Logging instructs the browser to send reports when it hits network or application errors loading this site.",
  server: "Identifies the server software handling the request — worth reviewing whether exposing this value gives attackers useful reconnaissance.",
  "x-xss-protection":
    "Configures the legacy XSS Auditor built into older browsers. Deprecated in modern browsers, which rely on Content-Security-Policy instead.",
};

function formatHeaderName(key: string): string {
  return key
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

function gradeColor(grade: string): string {
  if (grade === "A+" || grade === "A") return "var(--success)";
  if (grade === "B" || grade === "C") return "var(--warning)";
  return "var(--danger)";
}

function GradeBadge({ grade, size = 56 }: { grade: string; size?: number }) {
  const color = gradeColor(grade);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 700,
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `2px solid color-mix(in srgb, ${color} 55%, transparent)`,
        flexShrink: 0,
      }}
    >
      {grade}
    </div>
  );
}

function HeaderChecklist({ coreHeaders, present }: { coreHeaders: string[]; present: string[] }) {
  const presentSet = new Set(present);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {coreHeaders.map((h) => {
        const ok = presentSet.has(h);
        const color = ok ? "var(--success)" : "var(--danger)";
        return (
          <span
            key={h}
            style={{
              fontSize: "0.78rem",
              padding: "0.3rem 0.6rem",
              borderRadius: 999,
              color,
              background: `color-mix(in srgb, ${color} 14%, transparent)`,
              border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
            }}
          >
            {ok ? "✓" : "✗"} {formatHeaderName(h)}
          </span>
        );
      })}
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  const headerEntries = Object.entries(report.headers);
  const additionalInfoEntries = headerEntries.filter(([k]) => HEADER_INFO[k]);

  return (
    <div className="dash-panel" style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.25rem" }}>
        <GradeBadge grade={report.grade} />
        <div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Security Report Summary</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Score: {report.score} / 100</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.35rem", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
        <div>
          <span style={{ color: "var(--ink-muted)" }}>Site:</span>{" "}
          <a href={report.finalUrl} target="_blank" rel="noreferrer">
            {report.finalUrl}
          </a>
        </div>
        <div>
          <span style={{ color: "var(--ink-muted)" }}>IP Address:</span> {report.ipAddress ?? "unknown"}
        </div>
        <div>
          <span style={{ color: "var(--ink-muted)" }}>Report Time:</span> {new Date(report.scannedAt).toLocaleString()}
        </div>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Headers</h3>
        <HeaderChecklist coreHeaders={report.coreHeaders} present={report.present} />
      </div>

      {report.missing.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem", color: "var(--danger)" }}>Missing Headers</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {report.missing.map((h) => (
              <div key={h} style={{ fontSize: "0.82rem" }}>
                <strong>{formatHeaderName(h)}</strong>
                <div style={{ color: "var(--ink-muted)" }}>{HEADER_INFO[h]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Raw Headers</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <tbody>
              {headerEntries.map(([k, v]) => (
                <tr key={k} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.35rem 0.6rem 0.35rem 0", color: "var(--ink-muted)", whiteSpace: "nowrap", verticalAlign: "top" }}>{k}</td>
                  <td style={{ padding: "0.35rem 0", wordBreak: "break-all" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Upcoming Headers</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0, marginBottom: "0.5rem" }}>
          Newer isolation headers, not yet counted toward the grade above.
        </p>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {report.upcomingHeaders.map((h) => (
            <div key={h} style={{ fontSize: "0.82rem" }}>
              <strong>{formatHeaderName(h)}</strong>
              <div style={{ color: "var(--ink-muted)" }}>{HEADER_INFO[h]}</div>
            </div>
          ))}
        </div>
      </div>

      {additionalInfoEntries.length > 0 && (
        <div>
          <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Additional Information</h3>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {additionalInfoEntries.map(([k]) => (
              <div key={k} style={{ fontSize: "0.82rem" }}>
                <strong>{k}</strong>
                <div style={{ color: "var(--ink-muted)" }}>{HEADER_INFO[k]}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SecurityHeadersClient({ savedWebsites }: { savedWebsites: SavedWebsite[] }) {
  const [url, setUrl] = useState("");
  const [websiteId, setWebsiteId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const loadHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/security-headers/scans?page=${page}&pageSize=10`);
      const data = await res.json();
      if (data.ok) {
        setHistory(data.data);
        setHistoryTotalPages(data.pagination.totalPages);
        setHistoryPage(data.pagination.page);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  async function runScan(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch("/api/admin/security-headers/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), websiteId: websiteId || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Scan failed.");
      } else {
        setReport(data.report);
        loadHistory(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  }

  async function viewHistoryScan(id: number) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/security-headers/scans/${id}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load scan.");
      } else {
        setReport(data.report);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="dash-panel">
        <form onSubmit={runScan} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          {savedWebsites.length > 0 && (
            <div className="field" style={{ marginBottom: 0, flex: "1 1 220px" }}>
              <label htmlFor="saved">Saved Website</label>
              <select
                id="saved"
                value={websiteId}
                onChange={(e) => {
                  const id = e.target.value;
                  setWebsiteId(id);
                  const site = savedWebsites.find((w) => String(w.Id) === id);
                  if (site) setUrl(site.Url);
                }}
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
              onChange={(e) => {
                setUrl(e.target.value);
                setWebsiteId("");
              }}
              required
              placeholder="https://example.com"
            />
          </div>
          <button className="submit" type="submit" disabled={loading} style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
            {loading ? "Scanning..." : "Scan"}
          </button>
        </form>
        {error && (
          <div className="error" style={{ marginTop: "1rem" }}>
            {error}
          </div>
        )}
      </div>

      {report && <ReportView report={report} />}

      <div className="dash-panel" style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Scan History</h2>
        {historyLoading ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : history.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No scans yet.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Grade</th>
                    <th style={{ padding: "0.4rem" }}>URL</th>
                    <th style={{ padding: "0.4rem" }}>IP Address</th>
                    <th style={{ padding: "0.4rem" }}>Scanned By</th>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }} />
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}>
                        <span style={{ color: gradeColor(row.Grade), fontWeight: 700 }}>{row.Grade}</span>
                      </td>
                      <td style={{ padding: "0.4rem", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.TargetUrl}
                      </td>
                      <td style={{ padding: "0.4rem" }}>{row.IpAddress ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{row.TriggeredByUsername ?? "-"}</td>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(row.ScannedAt).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <button
                          type="button"
                          onClick={() => viewHistoryScan(row.Id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--primary)",
                            cursor: "pointer",
                            padding: 0,
                            font: "inherit",
                            textDecoration: "underline",
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyTotalPages > 1 && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center", fontSize: "0.82rem" }}>
                <button type="button" disabled={historyPage <= 1} onClick={() => loadHistory(historyPage - 1)}>
                  Previous
                </button>
                <span>
                  Page {historyPage} of {historyTotalPages}
                </span>
                <button type="button" disabled={historyPage >= historyTotalPages} onClick={() => loadHistory(historyPage + 1)}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
