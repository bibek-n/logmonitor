"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import ScanTerminal from "./ScanTerminal";
import { CHECK_ORDER, CHECK_LABELS, type WordPressScanReport } from "@/lib/wordpressScan/shared";

interface SavedWebsite {
  Id: number;
  Name: string;
  Url: string;
  isWordPress: boolean;
}

interface HistoryRow {
  Id: number;
  TargetUrl: string;
  IsWordPress: boolean;
  CoreVersion: string | null;
  RiskLevel: string;
  TriggeredByUsername: string | null;
  ScannedAt: string;
}

function riskColor(risk: string): string {
  if (risk === "critical" || risk === "high") return "var(--danger)";
  if (risk === "medium" || risk === "low") return "var(--warning)";
  if (risk === "info") return "var(--success)";
  return "var(--ink-muted)";
}

function severityColor(severity: string): string {
  if (severity === "critical" || severity === "high") return "var(--danger)";
  if (severity === "medium" || severity === "low") return "var(--warning)";
  return "var(--ink-muted)";
}

interface ScanProgress {
  completed: number;
  total: number;
  statusText: string;
}

function ProgressBar({ progress }: { progress: ScanProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  return (
    <div className="dash-panel" style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.4rem" }}>
        <span style={{ color: "var(--ink-muted)" }}>{progress.statusText}</span>
        <span style={{ color: "var(--ink-muted)", whiteSpace: "nowrap", marginLeft: "0.75rem" }}>
          {progress.completed} / {progress.total} checks
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--primary)",
            borderRadius: 999,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const color = riskColor(risk);
  return (
    <span
      style={{
        fontSize: "0.75rem",
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "0.25rem 0.6rem",
        borderRadius: 999,
        color,
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      }}
    >
      {risk}
    </span>
  );
}

function ReportView({ report }: { report: WordPressScanReport }) {
  if (!report.isWordPress) {
    return (
      <div className="dash-panel" style={{ marginTop: "1rem" }}>
        <p style={{ color: "var(--ink-muted)" }}>
          WordPress was not detected at <strong>{report.targetUrl}</strong> — no wp-content/wp-includes/wp-json markers found.
        </p>
      </div>
    );
  }

  const checksByCheck = new Map(report.checks.map((c) => [c.check, c]));

  return (
    <div className="dash-panel" style={{ marginTop: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "grid", gap: "0.3rem", fontSize: "0.85rem" }}>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Site:</span>{" "}
            <a href={report.targetUrl} target="_blank" rel="noreferrer">
              {report.targetUrl}
            </a>
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Core version:</span> {report.coreVersion ?? "unknown"}
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Active theme:</span>{" "}
            {report.themeSlug ? `${report.themeSlug}${report.themeVersion ? ` v${report.themeVersion}` : ""}` : "unknown"}
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Plugins detected:</span>{" "}
            {report.plugins.length ? report.plugins.map((p) => p.slug + (p.version ? ` v${p.version}` : "")).join(", ") : "none from page assets"}
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Scanned:</span> {new Date(report.scannedAt).toLocaleString()}
          </div>
        </div>
        <RiskBadge risk={report.riskLevel} />
      </div>

      <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Checks</h3>
      <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.4rem" }}>Check</th>
              <th style={{ padding: "0.4rem" }}>Status</th>
              <th style={{ padding: "0.4rem" }}>Findings</th>
            </tr>
          </thead>
          <tbody>
            {CHECK_ORDER.map((id) => {
              const c = checksByCheck.get(id);
              const status = c?.status ?? "not_applicable";
              const color = status === "issues_found" ? "var(--danger)" : status === "error" ? "var(--warning)" : "var(--success)";
              const label = status === "issues_found" ? "Issues found" : status === "error" ? "Check failed" : status === "ok" ? "Clear" : "Not run";
              return (
                <tr key={id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{CHECK_LABELS[id]}</td>
                  <td style={{ padding: "0.4rem", color }}>{label}</td>
                  <td style={{ padding: "0.4rem" }}>{c?.findingCount ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {report.findings.length > 0 && (
        <div>
          <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Findings</h3>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {report.findings.map((f, i) => (
              <div key={i} style={{ fontSize: "0.82rem", borderLeft: `3px solid ${severityColor(f.severity)}`, paddingLeft: "0.6rem" }}>
                <div>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: severityColor(f.severity),
                      marginRight: "0.5rem",
                    }}
                  >
                    {f.severity}
                  </span>
                  <strong>{f.title}</strong>
                </div>
                {f.detail && <div style={{ color: "var(--ink-muted)", marginTop: "0.15rem" }}>{f.detail}</div>}
                {f.evidence && (
                  <div style={{ marginTop: "0.15rem" }}>
                    <a href={f.evidence} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem" }}>
                      Reference
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WordPressScanClient() {
  const [tab, setTab] = useState<"report" | "terminal">("report");
  const [websites, setWebsites] = useState<SavedWebsite[]>([]);
  const [websitesLoading, setWebsitesLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [websiteId, setWebsiteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WordPressScanReport | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  useEffect(() => {
    (async () => {
      setWebsitesLoading(true);
      try {
        const res = await fetch("/api/admin/wordpress-scan/websites");
        const data = await res.json();
        if (data.ok) setWebsites(data.data);
      } finally {
        setWebsitesLoading(false);
      }
    })();
  }, []);

  const loadHistory = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/wordpress-scan/scans?page=${page}&pageSize=10`);
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
    setProgress({ completed: 0, total: CHECK_ORDER.length, statusText: "Starting scan..." });

    function handleLine(line: string) {
      if (line.startsWith("__PROGRESS__")) {
        const [completedStr, totalStr] = line.slice("__PROGRESS__".length).split("/");
        setProgress((prev) => ({
          completed: Number(completedStr),
          total: Number(totalStr),
          statusText: prev?.statusText ?? "Scanning...",
        }));
        return;
      }
      if (line.startsWith("__REPORT__")) return; // handled separately below, not a status line
      if (line.length > 0) {
        setProgress((prev) => (prev ? { ...prev, statusText: line } : prev));
      }
    }

    try {
      const res = await fetch("/api/admin/wordpress-scan/cli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), websiteId: websiteId || null }),
      });

      let reportPayload: { scanId: number; report: WordPressScanReport } | null = null;

      if (!res.body) {
        const text = await res.text();
        for (const line of text.split("\n")) {
          if (line.startsWith("__REPORT__")) {
            try {
              reportPayload = JSON.parse(line.slice("__REPORT__".length));
            } catch {
              // Malformed sentinel — fall through, error surfaced below if reportPayload stays null.
            }
          } else {
            handleLine(line);
          }
        }
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            if (part.startsWith("__REPORT__")) {
              try {
                reportPayload = JSON.parse(part.slice("__REPORT__".length));
              } catch {
                // Malformed sentinel — ignore.
              }
            } else {
              handleLine(part);
            }
          }
        }
        if (buffer.startsWith("__REPORT__")) {
          try {
            reportPayload = JSON.parse(buffer.slice("__REPORT__".length));
          } catch {
            // Malformed sentinel — ignore.
          }
        } else if (buffer.length > 0) {
          handleLine(buffer);
        }
      }

      if (reportPayload) {
        setReport(reportPayload.report);
        loadHistory(1);
      } else {
        setError("Scan finished but no report was returned — check the Terminal tab for details.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function viewHistoryScan(id: number) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/wordpress-scan/scans/${id}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load scan.");
      } else {
        setReport(data.report);
        setTab("report");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["report", "terminal"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: tab === t ? "var(--primary)" : "var(--plane)",
              color: tab === t ? "#fff" : "var(--ink)",
              cursor: "pointer",
              fontSize: "0.85rem",
              textTransform: "capitalize",
            }}
          >
            {t === "report" ? "Report" : "Terminal (CLI)"}
          </button>
        ))}
      </div>

      {tab === "report" ? (
        <>
          <div className="dash-panel">
            <form onSubmit={runScan} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
                <label htmlFor="wp-saved">WordPress Website</label>
                <select
                  id="wp-saved"
                  value={websiteId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setWebsiteId(id);
                    const site = websites.find((w) => String(w.Id) === id);
                    if (site) setUrl(site.Url);
                  }}
                  disabled={websitesLoading}
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
                  <option value="">
                    {websitesLoading ? "Detecting WordPress sites..." : websites.length ? "-- choose a WordPress site --" : "No WordPress sites detected"}
                  </option>
                  {websites.map((w) => (
                    <option key={w.Id} value={w.Id}>
                      {w.Name} ({w.Url})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
                <label htmlFor="wp-url">Website URL</label>
                <input
                  id="wp-url"
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
                {loading ? "Scanning..." : "Run Deep Scan"}
              </button>
            </form>
            {error && (
              <div className="error" style={{ marginTop: "1rem" }}>
                {error}
              </div>
            )}
          </div>

          {progress && <ProgressBar progress={progress} />}

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
                        <th style={{ padding: "0.4rem" }}>Risk</th>
                        <th style={{ padding: "0.4rem" }}>URL</th>
                        <th style={{ padding: "0.4rem" }}>Core Version</th>
                        <th style={{ padding: "0.4rem" }}>Scanned By</th>
                        <th style={{ padding: "0.4rem" }}>Time</th>
                        <th style={{ padding: "0.4rem" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                          <td style={{ padding: "0.4rem" }}>
                            <RiskBadge risk={row.RiskLevel} />
                          </td>
                          <td style={{ padding: "0.4rem", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.TargetUrl}
                          </td>
                          <td style={{ padding: "0.4rem" }}>{row.CoreVersion ?? "-"}</td>
                          <td style={{ padding: "0.4rem" }}>{row.TriggeredByUsername ?? "-"}</td>
                          <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(row.ScannedAt).toLocaleString()}</td>
                          <td style={{ padding: "0.4rem" }}>
                            <button
                              type="button"
                              onClick={() => viewHistoryScan(row.Id)}
                              style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", padding: 0, font: "inherit", textDecoration: "underline" }}
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
        </>
      ) : (
        <ScanTerminal savedWebsites={websites} onReportReady={(scanId) => viewHistoryScan(scanId)} />
      )}
    </div>
  );
}
