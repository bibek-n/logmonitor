"use client";

import { useCallback, useEffect, useState, type FormEvent, type CSSProperties } from "react";
import Link from "next/link";
import ScanTerminal from "./ScanTerminal";
import WordPressScanDashboard from "./WordPressScanDashboard";
import WordPressFindingsPanel from "./WordPressFindingsPanel";
import WordPressSchedulesPanel from "./WordPressSchedulesPanel";
import { CHECK_ORDER, CHECK_LABELS, PROFILE_CHECKS, SCAN_PROFILE_LABELS, type ScanProfile, type WordPressScanReport } from "@/lib/wordpressScan/shared";

const PROFILE_OPTIONS: ScanProfile[] = ["quick", "standard", "comprehensive"];

interface SavedWebsite {
  Id: number;
  Name: string;
  Url: string;
  PhpVersion: string | null;
  isWordPress: boolean;
}

interface HistoryRow {
  Id: number;
  TargetUrl: string;
  IsWordPress: boolean;
  CoreVersion: string | null;
  PhpVersion: string | null;
  LatestCoreVersion: string | null;
  RiskLevel: string;
  TriggeredByUsername: string | null;
  ScannedAt: string;
}

interface AllSitesScanResultEntry {
  websiteId: number;
  name: string;
  url: string;
  scanId: number;
  isWordPress: boolean;
  coreVersion: string | null;
  latestCoreVersion: string | null;
  phpVersion: string | null;
  corePhpRequirement: string | null;
  pluginCount: number;
  findingCount: number;
  riskLevel: string;
  error: string | null;
}

// Loose dotted-version "is a behind b" check - same shape as the server-side compareVersions
// in checks.ts, duplicated client-side since this is purely a display decision (which badge
// to show), not a network call.
function isBehind(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0;
  }
  return false;
}

const upgradeBadgeStyle: CSSProperties = {
  marginLeft: "0.4rem",
  display: "inline-block",
  padding: "0.1rem 0.5rem",
  borderRadius: 999,
  fontSize: "0.72rem",
  fontWeight: 700,
  background: "var(--danger)",
  color: "#fff",
};

function paginationButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: "0.35rem 0.9rem",
    borderRadius: 8,
    border: disabled ? "1px solid var(--border)" : "1px solid var(--primary)",
    background: disabled ? "var(--surface-2)" : "var(--primary)",
    color: disabled ? "var(--ink-muted)" : "#fff",
    fontSize: "0.82rem",
    cursor: disabled ? "default" : "pointer",
  };
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

function PdfLinks({ scanId }: { scanId: number | null }) {
  if (!scanId) return null;
  return (
    <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.8rem" }}>
      <a href={`/api/admin/wordpress-scan/scans/${scanId}/pdf?view=1`} target="_blank" rel="noreferrer" style={{ color: "var(--series-1)" }}>
        View PDF
      </a>
      <a href={`/api/admin/wordpress-scan/scans/${scanId}/pdf`} style={{ color: "var(--series-1)" }}>
        Download PDF
      </a>
    </div>
  );
}

function ReportView({ report, scanId }: { report: WordPressScanReport; scanId: number | null }) {
  if (!report.isWordPress) {
    return (
      <div className="dash-panel" style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
          <p style={{ color: "var(--ink-muted)", margin: 0 }}>
            WordPress was not detected at <strong>{report.targetUrl}</strong> — no wp-content/wp-includes/wp-json markers found.
          </p>
          <PdfLinks scanId={scanId} />
        </div>
      </div>
    );
  }

  const checksByCheck = new Map(report.checks.map((c) => [c.check, c]));
  const coreOutdated = isBehind(report.coreVersion, report.latestCoreVersion);
  const phpTooOld = isBehind(report.phpVersion, report.corePhpRequirement);

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
            {coreOutdated ? (
              <span className="vuln-badge" style={upgradeBadgeStyle}>
                upgrade to {report.latestCoreVersion}
              </span>
            ) : (
              report.latestCoreVersion && (
                <span style={{ color: "var(--success)", fontSize: "0.78rem", marginLeft: "0.4rem" }}>up to date (latest {report.latestCoreVersion})</span>
              )
            )}
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>PHP version:</span> {report.phpVersion ?? "unknown (not linked to a saved website)"}
            {phpTooOld && (
              <span className="vuln-badge" style={upgradeBadgeStyle}>
                upgrade to {report.corePhpRequirement}+
              </span>
            )}
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Active theme:</span>{" "}
            {report.themeSlug ? `${report.themeSlug}${report.themeVersion ? ` v${report.themeVersion}` : ""}` : "unknown"}
          </div>
          <div>
            <span style={{ color: "var(--ink-muted)" }}>Scanned:</span> {new Date(report.scannedAt).toLocaleString()}
          </div>
        </div>
        <div style={{ display: "grid", gap: "0.5rem", justifyItems: "end" }}>
          <RiskBadge risk={report.riskLevel} />
          <PdfLinks scanId={scanId} />
        </div>
      </div>

      <h3 style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>Plugins ({report.plugins.length})</h3>
      <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
        {report.plugins.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
            None detected from page assets — plugins that only run server-side (caching, security, SEO) leave no trace here.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Plugin</th>
                <th style={{ padding: "0.4rem" }}>Version</th>
              </tr>
            </thead>
            <tbody>
              {report.plugins.map((p) => (
                <tr key={p.slug} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{p.slug}</td>
                  <td style={{ padding: "0.4rem" }}>{p.version ?? "unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
                {f.recommendation && <div style={{ color: "var(--ink-muted)", marginTop: "0.15rem" }}>Fix: {f.recommendation}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AllSitesTable({ results }: { results: AllSitesScanResultEntry[] }) {
  return (
    <div className="dash-panel" style={{ marginTop: "1rem" }}>
      <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>
        Scan All Results ({results.length} site{results.length === 1 ? "" : "s"})
      </h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.4rem" }}>Site</th>
              <th style={{ padding: "0.4rem" }}>Core version</th>
              <th style={{ padding: "0.4rem" }}>PHP version</th>
              <th style={{ padding: "0.4rem" }}>Plugins</th>
              <th style={{ padding: "0.4rem" }}>Risk</th>
              <th style={{ padding: "0.4rem" }} />
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const coreOutdated = isBehind(r.coreVersion, r.latestCoreVersion);
              const phpTooOld = isBehind(r.phpVersion, r.corePhpRequirement);
              return (
                <tr key={r.websiteId} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.url}>
                    {r.name}
                  </td>
                  <td style={{ padding: "0.4rem" }}>
                    {r.error ? (
                      <span style={{ color: "var(--warning)" }}>{r.error}</span>
                    ) : !r.isWordPress ? (
                      <span style={{ color: "var(--ink-muted)" }}>not WordPress</span>
                    ) : (
                      <>
                        {r.coreVersion ?? "unknown"}
                        {coreOutdated && (
                          <span className="vuln-badge" style={upgradeBadgeStyle}>
                            upgrade to {r.latestCoreVersion}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td style={{ padding: "0.4rem" }}>
                    {r.phpVersion ?? "-"}
                    {phpTooOld && (
                      <span className="vuln-badge" style={upgradeBadgeStyle}>
                        upgrade to {r.corePhpRequirement}+
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.4rem" }}>{r.isWordPress ? r.pluginCount : "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{r.isWordPress && !r.error ? <RiskBadge risk={r.riskLevel} /> : "-"}</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                    {r.scanId > 0 && (
                      <>
                        <Link
                          href={`/dashboard/audit/wordpress-scan/report/${r.scanId}`}
                          style={{ color: "var(--primary)", padding: 0, font: "inherit", textDecoration: "underline", marginRight: "0.6rem" }}
                        >
                          View
                        </Link>
                        <a href={`/api/admin/wordpress-scan/scans/${r.scanId}/pdf`} style={{ color: "var(--primary)", fontSize: "inherit" }}>
                          PDF
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WordPressScanClient() {
  const [tab, setTab] = useState<"report" | "terminal" | "findings" | "schedules">("report");
  const [websites, setWebsites] = useState<SavedWebsite[]>([]);
  const [websitesLoading, setWebsitesLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [websiteId, setWebsiteId] = useState("");
  const [profile, setProfile] = useState<ScanProfile>("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WordPressScanReport | null>(null);
  // WordPressScanReport (shared.ts) is deliberately id-less - it's shared with client code and
  // kept to pure display fields. The DB id is tracked separately here just to build the PDF
  // download link, set from whichever path populated `report` (a fresh scan's __REPORT__
  // sentinel, or /scans/[id] when viewing history).
  const [scanId, setScanId] = useState<number | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  const [scanningAll, setScanningAll] = useState(false);
  const [allProgress, setAllProgress] = useState<ScanProgress | null>(null);
  const [allResults, setAllResults] = useState<AllSitesScanResultEntry[] | null>(null);

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
    setScanId(null);
    setProgress({ completed: 0, total: PROFILE_CHECKS[profile].length, statusText: "Starting scan..." });

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
        body: JSON.stringify({ url: url.trim(), websiteId: websiteId || null, profile }),
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
        setScanId(reportPayload.scanId);
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

  // Bulk twin of runScan() above - same streaming-line protocol, but against
  // /scan-all (every WordPress site from the Websites list, not just one), parsing
  // __SITE_PROGRESS__/__ALLDONE__ sentinels instead of __PROGRESS__/__REPORT__.
  async function runScanAll() {
    setScanningAll(true);
    setError(null);
    setAllResults(null);
    setReport(null);
    setScanId(null);
    setAllProgress({ completed: 0, total: 1, statusText: "Starting scan..." });

    function handleLine(line: string) {
      if (line.startsWith("__SITE_PROGRESS__")) {
        const [completedStr, totalStr] = line.slice("__SITE_PROGRESS__".length).split("/");
        setAllProgress((prev) => ({
          completed: Number(completedStr),
          total: Number(totalStr),
          statusText: prev?.statusText ?? "Scanning...",
        }));
        return;
      }
      if (line.startsWith("__ALLDONE__")) return;
      if (line.length > 0) {
        setAllProgress((prev) => (prev ? { ...prev, statusText: line } : prev));
      }
    }

    try {
      const res = await fetch("/api/admin/wordpress-scan/scan-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      let results: AllSitesScanResultEntry[] | null = null;

      if (!res.body) {
        const text = await res.text();
        for (const line of text.split("\n")) {
          if (line.startsWith("__ALLDONE__")) {
            try {
              results = JSON.parse(line.slice("__ALLDONE__".length));
            } catch {
              // Malformed sentinel — ignore.
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
            if (part.startsWith("__ALLDONE__")) {
              try {
                results = JSON.parse(part.slice("__ALLDONE__".length));
              } catch {
                // Malformed sentinel — ignore.
              }
            } else {
              handleLine(part);
            }
          }
        }
        if (buffer.startsWith("__ALLDONE__")) {
          try {
            results = JSON.parse(buffer.slice("__ALLDONE__".length));
          } catch {
            // Malformed sentinel — ignore.
          }
        } else if (buffer.length > 0) {
          handleLine(buffer);
        }
      }

      if (results) {
        setAllResults(results);
        loadHistory(1);
      } else {
        setError("Scan-all finished but no results were returned.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan-all failed.");
    } finally {
      setScanningAll(false);
      setAllProgress(null);
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
        setScanId(id);
        setTab("report");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setLoading(false);
    }
  }

  const TAB_LABELS = { report: "Report", terminal: "Terminal (CLI)", findings: "Findings", schedules: "Schedules" } as const;

  return (
    <div>
      <WordPressScanDashboard />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {(["report", "terminal", "findings", "schedules"] as const).map((t) => (
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
            }}
          >
            {TAB_LABELS[t]}
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
              <div className="field" style={{ marginBottom: 0, flex: "0 1 180px" }}>
                <label htmlFor="wp-profile">Scan Profile</label>
                <select
                  id="wp-profile"
                  value={profile}
                  onChange={(e) => setProfile(e.target.value as ScanProfile)}
                  title="Quick: 4 fast checks. Standard: +4 moderate checks. Comprehensive: all 10, including path-probing checks."
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
                  {PROFILE_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {SCAN_PROFILE_LABELS[p]} ({PROFILE_CHECKS[p].length} checks)
                    </option>
                  ))}
                </select>
              </div>
              <button className="submit" type="submit" disabled={loading || scanningAll} style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
                {loading ? "Scanning..." : "Run Deep Scan"}
              </button>
              <button
                type="button"
                onClick={runScanAll}
                disabled={loading || scanningAll}
                title="Runs this same deep scan against every WordPress site in the Websites list"
                style={{
                  width: "auto",
                  marginTop: 0,
                  padding: "0.6rem 1.25rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--plane)",
                  color: "var(--ink)",
                  fontSize: "0.9rem",
                  cursor: loading || scanningAll ? "default" : "pointer",
                }}
              >
                {scanningAll ? "Scanning all..." : "Scan All WordPress Sites"}
              </button>
            </form>
            {error && (
              <div className="error" style={{ marginTop: "1rem" }}>
                {error}
              </div>
            )}
          </div>

          {progress && <ProgressBar progress={progress} />}
          {allProgress && <ProgressBar progress={allProgress} />}

          {allResults && <AllSitesTable results={allResults} />}

          {report && <ReportView report={report} scanId={scanId} />}

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
                        <th style={{ padding: "0.4rem" }}>PHP Version</th>
                        <th style={{ padding: "0.4rem" }}>Scanned By</th>
                        <th style={{ padding: "0.4rem" }}>Time</th>
                        <th style={{ padding: "0.4rem" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => {
                        const coreOutdated = isBehind(row.CoreVersion, row.LatestCoreVersion);
                        return (
                        <tr key={row.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                          <td style={{ padding: "0.4rem" }}>
                            <RiskBadge risk={row.RiskLevel} />
                          </td>
                          <td style={{ padding: "0.4rem", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.TargetUrl}
                          </td>
                          <td style={{ padding: "0.4rem" }}>
                            {row.CoreVersion ?? "-"}
                            {coreOutdated && (
                              <span className="vuln-badge" style={upgradeBadgeStyle}>
                                upgrade to {row.LatestCoreVersion}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "0.4rem" }}>{row.PhpVersion ?? "-"}</td>
                          <td style={{ padding: "0.4rem" }}>{row.TriggeredByUsername ?? "-"}</td>
                          <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(row.ScannedAt).toLocaleString()}</td>
                          <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                            <Link
                              href={`/dashboard/audit/wordpress-scan/report/${row.Id}`}
                              style={{ color: "var(--primary)", padding: 0, font: "inherit", textDecoration: "underline", marginRight: "0.6rem" }}
                            >
                              View
                            </Link>
                            <a href={`/api/admin/wordpress-scan/scans/${row.Id}/pdf`} style={{ color: "var(--primary)", fontSize: "inherit" }}>
                              PDF
                            </a>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {historyTotalPages > 1 && (
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center", fontSize: "0.82rem" }}>
                    <button
                      type="button"
                      disabled={historyPage <= 1}
                      onClick={() => loadHistory(historyPage - 1)}
                      style={paginationButtonStyle(historyPage <= 1)}
                    >
                      Previous
                    </button>
                    <span>
                      Page {historyPage} of {historyTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={historyPage >= historyTotalPages}
                      onClick={() => loadHistory(historyPage + 1)}
                      style={paginationButtonStyle(historyPage >= historyTotalPages)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : tab === "terminal" ? (
        <ScanTerminal savedWebsites={websites} onReportReady={(scanId) => viewHistoryScan(scanId)} />
      ) : tab === "findings" ? (
        <WordPressFindingsPanel websites={websites} />
      ) : (
        <WordPressSchedulesPanel />
      )}
    </div>
  );
}
