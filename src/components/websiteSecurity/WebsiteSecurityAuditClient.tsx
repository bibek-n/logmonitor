"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ScheduleModal } from "./ScheduleModal";

interface ScanLogLine {
  Id: number;
  Message: string;
  CreatedAt: string;
}
interface ScanProgress {
  scanId: number;
  status: string;
  lines: ScanLogLine[];
}

const SCAN_LOG_POLL_MS = 1500;

export interface WebsiteSummary {
  Id: number;
  Name: string;
  Url: string;
  LatestScanId: number | null;
  LatestScanDate: string | null;
  LatestStatus: string | null;
  LatestPlatform: string | null;
  LatestScore: number | null;
  LatestRisk: string | null;
  ScheduleType: string | null;
}

function scanTypeInfo(scheduleType: string | null): { label: string; color: string } {
  if (scheduleType === "Disabled") return { label: "Disabled", color: "#dc2626" };
  if (scheduleType == null) return { label: "Automatic", color: "#16a34a" };
  return { label: "Schedule", color: "#d97706" };
}

interface Finding {
  category: string;
  severity: string;
  title: string;
  description?: string | null;
  evidence?: string | null;
  recommendation?: string | null;
  cvss?: number | null;
  cwe?: string | null;
  owaspCategory?: string | null;
  confidence?: string | null;
  affectedUrl?: string | null;
  parameter?: string | null;
}
interface DependencyFinding {
  packageName: string;
  currentVersion: string | null;
  ecosystem: string;
  severity: string;
  cveIds: string | null;
  reason: string;
}
interface CodeFinding {
  category: string;
  severity: string;
  location: string | null;
  maskedEvidence: string;
  recommendation: string;
}
interface ScanHistoryRow {
  Id: number;
  ScanDate: string;
  Status: string;
  SecurityScore: number | null;
  RiskLevel: string | null;
  DetectedPlatform: string | null;
  HasReport: number;
}
interface ModuleScores {
  headers: number;
  ssl: number;
  auth: number;
  cookies: number;
  js: number;
  dns: number;
  email: number;
  server: number;
  owasp: number;
  performance: number;
}
interface ScanDetail {
  scanId: number;
  scanDate: string;
  detectedPlatform: string;
  securityScore: number;
  riskLevel: string;
  scanDurationMs: number | null;
  websiteStatus: string | null;
  hostingProvider: string | null;
  asn: string | null;
  ipAddress: string | null;
  ipv6Address: string | null;
  moduleScores: ModuleScores;
  findings: Finding[];
  dependencyFindings: DependencyFinding[];
  codeFindings: CodeFinding[];
  recommendations: string[];
  previousScan: { scanDate: string; securityScore: number; riskLevel: string } | null;
}

const MODULE_LABELS: [keyof ModuleScores, string][] = [
  ["headers", "HTTP Headers"],
  ["ssl", "SSL/TLS"],
  ["auth", "Authentication"],
  ["cookies", "Cookies"],
  ["js", "JavaScript / Dependencies"],
  ["dns", "DNS"],
  ["email", "Email Security"],
  ["server", "Server Security"],
  ["owasp", "OWASP Top 10"],
  ["performance", "Performance"],
];
interface WebsiteDetailResponse {
  ok: boolean;
  website: { Id: number; Name: string; Url: string; Enabled: boolean };
  history: ScanHistoryRow[];
  sourceInput: { LockfileFilename: string | null; UpdatedAt: string } | null;
  latestDetail: ScanDetail | null;
  emailLogs: { ToAddress: string; Success: boolean; SentAt: string }[];
}

type Tone = "success" | "info" | "warning" | "danger" | "neutral";

function riskTone(risk: string | null): Tone {
  switch (risk) {
    case "Low":
      return "success";
    case "Medium":
      return "info";
    case "High":
      return "warning";
    case "Critical":
      return "danger";
    default:
      return "neutral";
  }
}

function severityTone(sev: string): Tone {
  switch (sev) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "success";
    default:
      return "neutral";
  }
}

export default function WebsiteSecurityAuditClient({ websites }: { websites: WebsiteSummary[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<WebsiteDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [scanningIds, setScanningIds] = useState<Set<number>>(new Set());
  const [scanProgress, setScanProgress] = useState<Record<number, ScanProgress>>({});
  const [scheduleWebsiteId, setScheduleWebsiteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lockfileFilename, setLockfileFilename] = useState("");
  const [lockfileContent, setLockfileContent] = useState("");
  const [sourceSnippet, setSourceSnippet] = useState("");
  const [savingInputs, setSavingInputs] = useState(false);
  const pollTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const lastSeenIdRef = useRef<Record<number, number>>({});

  // Stop any in-flight polling loops if the component unmounts (e.g. navigating away
  // mid-scan) so they don't keep firing against a dead component.
  useEffect(() => {
    const timers = pollTimersRef.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  async function loadDetail(id: number) {
    setSelectedId(id);
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/website-security/website/${id}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load website detail.");
        setDetail(null);
      } else {
        setDetail(data);
        setLockfileFilename(data.sourceInput?.LockfileFilename ?? "");
        setLockfileContent("");
        setSourceSnippet("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load website detail.");
    } finally {
      setLoadingDetail(false);
    }
  }

  function stopPolling(websiteId: number) {
    const timer = pollTimersRef.current[websiteId];
    if (timer) {
      clearTimeout(timer);
      delete pollTimersRef.current[websiteId];
    }
  }

  function pollScanLog(websiteId: number, scanId: number) {
    lastSeenIdRef.current[websiteId] = 0;

    async function tick() {
      try {
        const sinceId = lastSeenIdRef.current[websiteId] ?? 0;
        const res = await fetch(`/api/admin/website-security/scan-log/${scanId}?sinceId=${sinceId}`);
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Failed to fetch scan progress.");
        } else {
          if (data.lines.length > 0) {
            lastSeenIdRef.current[websiteId] = data.lines[data.lines.length - 1].Id;
          }
          setScanProgress((prev) => {
            const existing = prev[websiteId];
            const mergedLines = existing && existing.scanId === scanId ? [...existing.lines, ...data.lines] : data.lines;
            return { ...prev, [websiteId]: { scanId, status: data.status, lines: mergedLines } };
          });
          if (data.status === "Completed" || data.status === "Failed") {
            stopPolling(websiteId);
            setScanningIds((prev) => {
              const next = new Set(prev);
              next.delete(websiteId);
              return next;
            });
            if (data.status === "Failed") {
              setError("Scan failed — see the progress log below for details.");
            } else {
              // The top-level table's Score/Risk/Last Scan/Report columns are all from the
              // initial server-rendered `websites` prop - only refreshing the detail panel
              // below (when open) left them stale until a manual reload.
              router.refresh();
              if (selectedId === websiteId) await loadDetail(websiteId);
            }
            return;
          }
        }
      } catch (err) {
        // Transient network hiccups shouldn't kill the poll loop — keep trying until the
        // scan actually reaches a terminal status.
        console.error("[scan-log poll]", err);
      }
      pollTimersRef.current[websiteId] = setTimeout(tick, SCAN_LOG_POLL_MS);
    }

    tick();
  }

  async function runScan(id: number) {
    setScanningIds((prev) => new Set(prev).add(id));
    setScanProgress((prev) => ({ ...prev, [id]: { scanId: 0, status: "Starting", lines: [] } }));
    setError(null);
    try {
      const res = await fetch("/api/admin/website-security/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Scan failed to start.");
        setScanningIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }
      setScanProgress((prev) => ({ ...prev, [id]: { scanId: data.scanId, status: "Running", lines: [] } }));
      pollScanLog(id, data.scanId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed to start.");
      setScanningIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function saveSourceInputs() {
    if (!selectedId) return;
    setSavingInputs(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/website-security/source-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: selectedId, lockfileFilename, lockfileContent, sourceSnippet }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to save.");
      } else {
        await loadDetail(selectedId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingInputs(false);
    }
  }

  return (
    <>
      {error && (
        <div className="error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="dash-panel">
        {websites.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No enabled websites. Add or enable one from the Websites page.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Website</th>
                <th style={{ padding: "0.5rem" }}>Platform</th>
                <th style={{ padding: "0.5rem" }}>Last Scan</th>
                <th style={{ padding: "0.5rem" }}>Score</th>
                <th style={{ padding: "0.5rem" }}>Risk</th>
                <th style={{ padding: "0.5rem" }}></th>
                <th style={{ padding: "0.5rem" }}>Type</th>
                <th style={{ padding: "0.5rem" }}>Report</th>
              </tr>
            </thead>
            <tbody>
              {websites.map((w) => {
                const scanning = scanningIds.has(w.Id);
                const scannedToday = w.LatestScanDate && new Date(w.LatestScanDate).toDateString() === new Date().toDateString();
                const nextScanLabel = scannedToday ? "Tomorrow (~02:00)" : "Today (~02:00)";
                const typeInfo = scanTypeInfo(w.ScheduleType);
                return (
                  <tr key={w.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <button
                        onClick={() => loadDetail(w.Id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--series-1)",
                          cursor: "pointer",
                          padding: 0,
                          textAlign: "left",
                          font: "inherit",
                        }}
                      >
                        {w.Name}
                      </button>
                      <div style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>{w.Url}</div>
                    </td>
                    <td style={{ padding: "0.5rem" }}>{w.LatestPlatform ?? "—"}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {w.LatestScanDate ? new Date(w.LatestScanDate).toLocaleDateString() : "Never scanned"}
                      <div style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>Next: {nextScanLabel}</div>
                    </td>
                    <td style={{ padding: "0.5rem" }}>{w.LatestScore ?? "—"}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {w.LatestRisk ? <Badge tone={riskTone(w.LatestRisk)}>{w.LatestRisk}</Badge> : <Badge tone="neutral">Not scanned</Badge>}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <button
                        onClick={() => runScan(w.Id)}
                        disabled={scanning}
                        className="submit"
                        style={{ width: "auto", marginTop: 0, padding: "0.35rem 0.9rem", fontSize: "0.78rem", marginRight: "0.4rem" }}
                      >
                        {scanning ? "Scanning..." : "Scan now"}
                      </button>
                      <button
                        onClick={() => setScheduleWebsiteId(w.Id)}
                        className="submit"
                        style={{ width: "auto", marginTop: 0, padding: "0.35rem 0.9rem", fontSize: "0.78rem", background: "transparent", border: "1px solid var(--series-1)", color: "var(--series-1)" }}
                      >
                        Schedule
                      </button>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <span className="flex items-center gap-2" style={{ fontSize: "0.78rem", fontWeight: 600, color: typeInfo.color }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: typeInfo.color, flexShrink: 0 }} />
                        {typeInfo.label}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {w.LatestScanId && w.LatestStatus === "Completed" ? (
                        <>
                          <a href={`/api/admin/website-security/report/${w.LatestScanId}?view=1`} target="_blank" rel="noreferrer" style={{ color: "var(--series-1)", fontSize: "0.78rem" }}>
                            View PDF
                          </a>
                          {" · "}
                          <a href={`/api/admin/website-security/report/${w.LatestScanId}`} style={{ color: "var(--series-1)", fontSize: "0.78rem" }}>
                            Download
                          </a>
                        </>
                      ) : (
                        <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {Object.entries(scanProgress).map(([websiteIdStr, progress]) => {
        const websiteId = Number(websiteIdStr);
        const website = websites.find((w) => w.Id === websiteId);
        if (!website) return null;
        return (
          <div key={websiteId} className="dash-panel">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "0.9rem", margin: 0 }}>Scan progress — {website.Name}</h3>
              <Badge tone={progress.status === "Completed" ? "success" : progress.status === "Failed" ? "danger" : "info"}>
                {progress.status === "Running" || progress.status === "Starting" ? "Scanning…" : progress.status}
              </Badge>
            </div>
            <pre
              style={{
                background: "#0b0f14",
                color: "#7ee787",
                fontFamily: "monospace",
                fontSize: "0.78rem",
                lineHeight: 1.5,
                padding: "0.75rem 1rem",
                borderRadius: 6,
                maxHeight: 260,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
              ref={(el) => {
                if (el) el.scrollTop = el.scrollHeight;
              }}
            >
              {progress.lines.length === 0
                ? "Waiting for scan to start...\n"
                : progress.lines.map((l) => `[${new Date(l.CreatedAt).toLocaleTimeString()}] ${l.Message}`).join("\n")}
            </pre>
            {(progress.status === "Completed" || progress.status === "Failed") && (
              <button
                className="submit"
                onClick={() => setScanProgress((prev) => { const next = { ...prev }; delete next[websiteId]; return next; })}
                style={{ width: "auto", marginTop: "0.6rem", padding: "0.3rem 0.9rem", fontSize: "0.78rem" }}
              >
                Dismiss
              </button>
            )}
          </div>
        );
      })}

      {selectedId && (
        <div className="dash-panel">
          {loadingDetail ? (
            <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
          ) : detail ? (
            <>
              <h2 style={{ fontSize: "1rem", marginTop: 0 }}>{detail.website.Name}</h2>

              {detail.latestDetail ? (
                <>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                    <Badge tone={riskTone(detail.latestDetail.riskLevel)}>{detail.latestDetail.riskLevel} risk</Badge>
                    <Badge tone="neutral">Score {detail.latestDetail.securityScore}/100</Badge>
                    <Badge tone="neutral">{detail.latestDetail.detectedPlatform}</Badge>
                    <Badge tone="neutral">Last scan {detail.latestDetail.scanDate}</Badge>
                    {detail.latestDetail.scanDurationMs != null && <Badge tone="neutral">{(detail.latestDetail.scanDurationMs / 1000).toFixed(1)}s</Badge>}
                    <a
                      href={`/api/admin/website-security/report/${detail.latestDetail.scanId}?view=1`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        border: "1px solid var(--series-1)",
                        color: "var(--series-1)",
                        borderRadius: 999,
                        padding: "0.15rem 0.75rem",
                        fontSize: "0.78rem",
                        textDecoration: "none",
                      }}
                    >
                      View PDF
                    </a>
                    <a
                      href={`/api/admin/website-security/report/${detail.latestDetail.scanId}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        border: "1px solid var(--series-1)",
                        color: "var(--series-1)",
                        borderRadius: 999,
                        padding: "0.15rem 0.75rem",
                        fontSize: "0.78rem",
                        textDecoration: "none",
                      }}
                    >
                      Download Full Report (PDF)
                    </a>
                  </div>

                  <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                    Hosting: {detail.latestDetail.hostingProvider ?? "unknown"}
                    {detail.latestDetail.asn ? ` (${detail.latestDetail.asn})` : ""} · IPv4: {detail.latestDetail.ipAddress ?? "unknown"}
                    {detail.latestDetail.ipv6Address ? ` · IPv6: ${detail.latestDetail.ipv6Address}` : ""} · Status:{" "}
                    {detail.latestDetail.websiteStatus ?? "unknown"}
                  </p>

                  {detail.latestDetail.previousScan && (
                    <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
                      Previous scan ({detail.latestDetail.previousScan.scanDate}): score {detail.latestDetail.previousScan.securityScore}, risk{" "}
                      {detail.latestDetail.previousScan.riskLevel}.
                    </p>
                  )}

                  <h3 style={{ fontSize: "0.9rem" }}>Module Scores</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.4rem", marginBottom: "1rem" }}>
                    {MODULE_LABELS.map(([key, label]) => (
                      <div key={key} style={{ fontSize: "0.78rem", display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                        <span style={{ color: "var(--ink-muted)" }}>{label}</span>
                        <Badge tone={riskTone(detail.latestDetail!.moduleScores[key] >= 80 ? "Low" : detail.latestDetail!.moduleScores[key] >= 60 ? "Medium" : detail.latestDetail!.moduleScores[key] >= 40 ? "High" : "Critical")}>
                          {detail.latestDetail!.moduleScores[key]}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ fontSize: "0.9rem" }}>Findings ({detail.latestDetail.findings.length})</h3>
                  {detail.latestDetail.findings.length === 0 ? (
                    <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No issues found.</p>
                  ) : (
                    <ul style={{ paddingLeft: "1.1rem", fontSize: "0.83rem" }}>
                      {detail.latestDetail.findings.map((f, i) => (
                        <li key={i} style={{ marginBottom: "0.5rem" }}>
                          <Badge tone={severityTone(f.severity)}>{f.severity}</Badge> <strong>{f.title}</strong>
                          {(f.cvss != null || f.cwe || f.owaspCategory || f.confidence) && (
                            <div style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>
                              {f.cvss != null && `CVSS ${f.cvss} `}
                              {f.cwe && `· ${f.cwe} `}
                              {f.owaspCategory && f.owaspCategory !== "N/A" && `· ${f.owaspCategory} `}
                              {f.confidence && `· Confidence: ${f.confidence}`}
                            </div>
                          )}
                          {f.description && <div style={{ color: "var(--ink-muted)" }}>{f.description}</div>}
                          {f.affectedUrl && (
                            <div style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>
                              {f.affectedUrl}
                              {f.parameter ? ` (parameter: ${f.parameter})` : ""}
                            </div>
                          )}
                          {f.recommendation && <div style={{ color: "var(--ink-muted)" }}>Fix: {f.recommendation}</div>}
                        </li>
                      ))}
                    </ul>
                  )}

                  <h3 style={{ fontSize: "0.9rem" }}>Package Risks ({detail.latestDetail.dependencyFindings.length})</h3>
                  {detail.latestDetail.dependencyFindings.length === 0 ? (
                    <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No lockfile supplied for this website, or no known issues found.</p>
                  ) : (
                    <ul style={{ paddingLeft: "1.1rem", fontSize: "0.83rem" }}>
                      {detail.latestDetail.dependencyFindings.map((d, i) => (
                        <li key={i} style={{ marginBottom: "0.5rem" }}>
                          <Badge tone={severityTone(d.severity)}>{d.severity}</Badge> {d.packageName}@{d.currentVersion ?? "unknown"} —{" "}
                          {d.reason === "known_cve" ? `CVEs: ${d.cveIds}` : "deprecated/unmaintained"}
                        </li>
                      ))}
                    </ul>
                  )}

                  <h3 style={{ fontSize: "0.9rem" }}>Code Risks ({detail.latestDetail.codeFindings.length})</h3>
                  {detail.latestDetail.codeFindings.length === 0 ? (
                    <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No source snippet supplied for this website, or no issues found.</p>
                  ) : (
                    <ul style={{ paddingLeft: "1.1rem", fontSize: "0.83rem" }}>
                      {detail.latestDetail.codeFindings.map((c, i) => (
                        <li key={i} style={{ marginBottom: "0.5rem" }}>
                          <Badge tone={severityTone(c.severity)}>{c.severity}</Badge> {c.category}
                          {c.location && ` — ${c.location}`}
                          <div style={{ color: "var(--ink-muted)" }}>Masked: {c.maskedEvidence}</div>
                          <div style={{ color: "var(--ink-muted)" }}>Fix: {c.recommendation}</div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {detail.latestDetail.recommendations.length > 0 && (
                    <>
                      <h3 style={{ fontSize: "0.9rem" }}>Recommendations</h3>
                      <ul style={{ paddingLeft: "1.1rem", fontSize: "0.83rem" }}>
                        {detail.latestDetail.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <p style={{ color: "var(--ink-muted)" }}>No completed scan yet for this website — click &quot;Scan now&quot; above.</p>
              )}

              <h3 style={{ fontSize: "0.9rem" }}>Scan History</h3>
              {detail.history.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No scans yet.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", marginBottom: "1rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "0.4rem" }}>Date</th>
                      <th style={{ padding: "0.4rem" }}>Status</th>
                      <th style={{ padding: "0.4rem" }}>Score</th>
                      <th style={{ padding: "0.4rem" }}>Risk</th>
                      <th style={{ padding: "0.4rem" }}>Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.history.map((h) => (
                      <tr key={h.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                        <td style={{ padding: "0.4rem" }}>{new Date(h.ScanDate).toLocaleDateString()}</td>
                        <td style={{ padding: "0.4rem" }}>{h.Status}</td>
                        <td style={{ padding: "0.4rem" }}>{h.SecurityScore ?? "—"}</td>
                        <td style={{ padding: "0.4rem" }}>{h.RiskLevel ? <Badge tone={riskTone(h.RiskLevel)}>{h.RiskLevel}</Badge> : "—"}</td>
                        <td style={{ padding: "0.4rem" }}>
                          {h.Status === "Completed" ? (
                            <>
                              <a href={`/api/admin/website-security/report/${h.Id}?view=1`} target="_blank" rel="noreferrer" style={{ color: "var(--series-1)" }}>
                                View
                              </a>
                              {" · "}
                              <a href={`/api/admin/website-security/report/${h.Id}`} style={{ color: "var(--series-1)" }}>
                                Download
                              </a>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {detail.emailLogs.length > 0 && (
                <>
                  <h3 style={{ fontSize: "0.9rem" }}>Latest Email Delivery</h3>
                  <ul style={{ paddingLeft: "1.1rem", fontSize: "0.82rem" }}>
                    {detail.emailLogs.map((e, i) => (
                      <li key={i}>
                        {e.ToAddress} — {e.Success ? "Delivered" : "Failed"} ({new Date(e.SentAt).toLocaleString()})
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3 style={{ fontSize: "0.9rem" }}>Dependency / Source Input (optional)</h3>
              <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>
                Paste a lockfile (package.json, package-lock.json, composer.lock, requirements.txt, Gemfile.lock,
                yarn.lock, pnpm-lock.yaml, pom.xml, packages.config, etc.) and/or a source snippet to enable package
                CVE lookups and hardcoded-secret/dangerous-function checks for this website. Optional — the rest of
                the scan runs without it. Leaving a box blank keeps whatever was saved before.
              </p>
              <div className="field" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="lockfileFilename">Lockfile filename</label>
                <input id="lockfileFilename" value={lockfileFilename} onChange={(e) => setLockfileFilename(e.target.value)} placeholder="package-lock.json" />
              </div>
              <div className="field" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="lockfileContent">Lockfile content</label>
                <textarea
                  id="lockfileContent"
                  value={lockfileContent}
                  onChange={(e) => setLockfileContent(e.target.value)}
                  rows={5}
                  style={{ width: "100%", fontFamily: "monospace", fontSize: "0.78rem" }}
                  placeholder="Paste the lockfile content here to update it, or leave blank to keep what's already saved."
                />
              </div>
              <div className="field" style={{ marginBottom: "0.5rem" }}>
                <label htmlFor="sourceSnippet">Source snippet (optional)</label>
                <textarea
                  id="sourceSnippet"
                  value={sourceSnippet}
                  onChange={(e) => setSourceSnippet(e.target.value)}
                  rows={5}
                  style={{ width: "100%", fontFamily: "monospace", fontSize: "0.78rem" }}
                  placeholder="Paste server-side source code to scan for hardcoded secrets / dangerous functions."
                />
              </div>
              <button className="submit" onClick={saveSourceInputs} disabled={savingInputs} style={{ width: "auto", padding: "0.5rem 1.25rem" }}>
                {savingInputs ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <p style={{ color: "var(--ink-muted)" }}>Select a website above to see its detail.</p>
          )}
        </div>
      )}

      {scheduleWebsiteId !== null && (
        <ScheduleModal
          websiteId={scheduleWebsiteId}
          websiteName={websites.find((w) => w.Id === scheduleWebsiteId)?.Name ?? ""}
          onClose={() => {
            setScheduleWebsiteId(null);
            // onClose fires on both cancel and successful save - refreshing unconditionally
            // is a harmless no-op on cancel and picks up the new Type column on save.
            router.refresh();
          }}
        />
      )}
    </>
  );
}
