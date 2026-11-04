"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ScheduleModal } from "./ScheduleModal";
import { ScoreTrendChart } from "./ScoreTrendChart";
import { CompareScansModal } from "./CompareScansModal";

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

interface Finding {
  id?: number;
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
  auditorNote?: string | null;
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

export function WebsiteSecurityDetailClient({ websiteId }: { websiteId: number }) {
  const router = useRouter();
  const [detail, setDetail] = useState<WebsiteDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [lockfileFilename, setLockfileFilename] = useState("");
  const [lockfileContent, setLockfileContent] = useState("");
  const [sourceSnippet, setSourceSnippet] = useState("");
  const [savingInputs, setSavingInputs] = useState(false);
  const [noteModalFindingId, setNoteModalFindingId] = useState<number | null>(null);
  const [noteModalDraft, setNoteModalDraft] = useState("");
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeenIdRef = useRef(0);

  useEffect(() => {
    loadDetail();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [websiteId]);

  async function loadDetail() {
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/website-security/website/${websiteId}`);
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

  function openNoteModal(findingId: number, currentValue: string | null | undefined) {
    setNoteModalFindingId(findingId);
    setNoteModalDraft(currentValue ?? "");
  }

  async function saveFindingNote() {
    const findingId = noteModalFindingId;
    if (findingId == null) return;
    const currentValue = detail?.latestDetail?.findings.find((f) => f.id === findingId)?.auditorNote ?? null;
    const note = noteModalDraft.trim() ? noteModalDraft.trim().slice(0, 500) : null;
    if (note === currentValue) {
      setNoteModalFindingId(null);
      return; // unchanged, nothing to save
    }

    setSavingNoteId(findingId);
    const prevDetail = detail;
    setDetail((d) =>
      d && d.latestDetail
        ? { ...d, latestDetail: { ...d.latestDetail, findings: d.latestDetail.findings.map((f) => (f.id === findingId ? { ...f, auditorNote: note } : f)) } }
        : d
    );
    try {
      const res = await fetch(`/api/admin/website-security/findings/${findingId}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!data.ok) {
        setDetail(prevDetail); // revert optimistic update on failure
        setError(data.error ?? "Failed to save reason.");
      } else {
        setNoteModalFindingId(null);
      }
    } catch (err) {
      setDetail(prevDetail);
      setError(err instanceof Error ? err.message : "Failed to save reason.");
    } finally {
      setSavingNoteId(null);
    }
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function pollScanLog(scanId: number) {
    lastSeenIdRef.current = 0;

    async function tick() {
      try {
        const res = await fetch(`/api/admin/website-security/scan-log/${scanId}?sinceId=${lastSeenIdRef.current}`);
        const data = await res.json();
        if (!data.ok) {
          setError(data.error ?? "Failed to fetch scan progress.");
        } else {
          if (data.lines.length > 0) {
            lastSeenIdRef.current = data.lines[data.lines.length - 1].Id;
          }
          setScanProgress((prev) => {
            const mergedLines = prev && prev.scanId === scanId ? [...prev.lines, ...data.lines] : data.lines;
            return { scanId, status: data.status, lines: mergedLines };
          });
          if (data.status === "Completed" || data.status === "Failed") {
            stopPolling();
            setScanning(false);
            if (data.status === "Failed") {
              setError("Scan failed — see the progress log below for details.");
            } else {
              router.refresh();
              await loadDetail();
            }
            return;
          }
        }
      } catch (err) {
        console.error("[scan-log poll]", err);
      }
      pollTimerRef.current = setTimeout(tick, SCAN_LOG_POLL_MS);
    }

    tick();
  }

  async function runScan() {
    setScanning(true);
    setScanProgress({ scanId: 0, status: "Starting", lines: [] });
    setError(null);
    try {
      const res = await fetch("/api/admin/website-security/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Scan failed to start.");
        setScanning(false);
        return;
      }
      setScanProgress({ scanId: data.scanId, status: "Running", lines: [] });
      pollScanLog(data.scanId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed to start.");
      setScanning(false);
    }
  }

  async function saveSourceInputs() {
    setSavingInputs(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/website-security/source-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, lockfileFilename, lockfileContent, sourceSnippet }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to save.");
      } else {
        await loadDetail();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingInputs(false);
    }
  }

  return (
    <>
      <Link href="/dashboard/audit/website-security" style={{ fontSize: "0.82rem", color: "var(--series-1)" }}>
        ← Back to all websites
      </Link>

      {error && (
        <div className="error" style={{ marginTop: "0.75rem" }}>
          {error}
        </div>
      )}

      {loadingDetail ? (
        <p style={{ color: "var(--ink-muted)", marginTop: "0.75rem" }}>Loading...</p>
      ) : detail ? (
        <div className="dash-panel" style={{ marginTop: "0.75rem" }}>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div>
              <h1 style={{ fontSize: "1.15rem", margin: 0 }}>{detail.website.Name}</h1>
              <div style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>{detail.website.Url}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={runScan} disabled={scanning} className="submit" style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem", fontSize: "0.82rem" }}>
                {scanning ? "Scanning..." : "Scan now"}
              </button>
              <button
                onClick={() => setScheduleOpen(true)}
                className="submit"
                style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem", fontSize: "0.82rem", background: "transparent", border: "1px solid var(--series-1)", color: "var(--series-1)" }}
              >
                Schedule
              </button>
            </div>
          </div>

          {scanProgress && (
            <div className="dash-panel" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "0.9rem", margin: 0 }}>Scan progress</h3>
                <div className="flex items-center gap-2">
                  <Badge tone={scanProgress.status === "Completed" ? "success" : scanProgress.status === "Failed" ? "danger" : "info"}>
                    {scanProgress.status === "Running" || scanProgress.status === "Starting" ? "Scanning…" : scanProgress.status}
                  </Badge>
                  {(scanProgress.status === "Completed" || scanProgress.status === "Failed") && (
                    <button className="submit" onClick={() => setScanProgress(null)} style={{ width: "auto", marginTop: 0, padding: "0.25rem 0.7rem", fontSize: "0.75rem" }}>
                      Dismiss
                    </button>
                  )}
                </div>
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
                {scanProgress.lines.length === 0
                  ? "Waiting for scan to start...\n"
                  : scanProgress.lines.map((l) => `[${new Date(l.CreatedAt).toLocaleTimeString()}] ${l.Message}`).join("\n")}
              </pre>
            </div>
          )}

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
                      {f.id != null && (
                        <div style={{ marginTop: "0.3rem" }}>
                          <button
                            type="button"
                            onClick={() => openNoteModal(f.id as number, f.auditorNote)}
                            disabled={savingNoteId === f.id}
                            style={{
                              background: "none",
                              border: "1px dashed var(--border)",
                              borderRadius: 6,
                              padding: "0.3rem 0.5rem",
                              color: f.auditorNote ? "var(--ink)" : "var(--ink-muted)",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              textAlign: "left",
                              maxWidth: 480,
                            }}
                          >
                            {f.auditorNote ? `Reason: ${f.auditorNote.slice(0, 80)}${f.auditorNote.length > 80 ? "…" : ""} (edit)` : "+ Add reason if unresolved"}
                          </button>
                        </div>
                      )}
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

          <div className="flex items-center justify-between" style={{ marginBottom: "0.4rem" }}>
            <h3 style={{ fontSize: "0.9rem", margin: 0 }}>Scan History</h3>
            {detail.history.filter((h) => h.Status === "Completed").length > 1 && (
              <button
                onClick={() => setCompareOpen(true)}
                className="submit"
                style={{ width: "auto", marginTop: 0, padding: "0.3rem 0.8rem", fontSize: "0.78rem", background: "transparent", border: "1px solid var(--series-1)", color: "var(--series-1)" }}
              >
                Compare scans
              </button>
            )}
          </div>
          <ScoreTrendChart history={detail.history} />
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
        </div>
      ) : null}

      {compareOpen && detail && <CompareScansModal history={detail.history} onClose={() => setCompareOpen(false)} />}

      <Modal
        open={noteModalFindingId !== null}
        onClose={() => setNoteModalFindingId(null)}
        title="Reason if unresolved"
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNoteModalFindingId(null)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.45rem 1rem", color: "var(--ink)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              className="submit"
              onClick={saveFindingNote}
              disabled={savingNoteId === noteModalFindingId}
              style={{ width: "auto", padding: "0.45rem 1.25rem" }}
            >
              {savingNoteId === noteModalFindingId ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <textarea
          autoFocus
          value={noteModalDraft}
          onChange={(e) => setNoteModalDraft(e.target.value)}
          placeholder="Why this can't be fixed yet..."
          rows={5}
          maxLength={500}
          style={{
            width: "100%",
            padding: "0.5rem 0.65rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--plane)",
            color: "var(--ink)",
            fontSize: "0.88rem",
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
      </Modal>

      {scheduleOpen && detail && (
        <ScheduleModal
          websiteId={websiteId}
          websiteName={detail.website.Name}
          onClose={() => {
            setScheduleOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
