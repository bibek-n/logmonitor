"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

const RISK_OPTIONS = ["All", "Critical", "High", "Medium", "Low", "Not scanned"];

// Clicking a website name navigates to its own detail page
// (WebsiteSecurityDetailClient, at /dashboard/audit/website-security/[id]) instead of
// expanding inline here — this component is now just the filterable list + per-row
// scan/schedule actions.
export default function WebsiteSecurityAuditClient({ websites }: { websites: WebsiteSummary[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [scanningIds, setScanningIds] = useState<Set<number>>(new Set());
  const [scanProgress, setScanProgress] = useState<Record<number, ScanProgress>>({});
  const [scheduleWebsiteId, setScheduleWebsiteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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
              // initial server-rendered `websites` prop.
              router.refresh();
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

  const platformOptions = ["All", ...Array.from(new Set(websites.map((w) => w.LatestPlatform).filter((p): p is string => !!p))).sort()];

  const filteredWebsites = websites.filter((w) => {
    const q = search.trim().toLowerCase();
    if (q && !w.Name.toLowerCase().includes(q) && !w.Url.toLowerCase().includes(q)) return false;
    if (riskFilter !== "All") {
      if (riskFilter === "Not scanned" ? w.LatestRisk !== null : w.LatestRisk !== riskFilter) return false;
    }
    if (platformFilter !== "All" && w.LatestPlatform !== platformFilter) return false;
    return true;
  });

  return (
    <>
      {error && (
        <div className="error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <div className="dash-panel" style={{ marginBottom: "1rem" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or URL..."
            style={{ flex: "1 1 220px", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", fontSize: "0.85rem" }}
          />
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", fontSize: "0.85rem" }}
          >
            {RISK_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r === "All" ? "All Risk Levels" : r}
              </option>
            ))}
          </select>
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", fontSize: "0.85rem" }}
          >
            {platformOptions.map((p) => (
              <option key={p} value={p}>
                {p === "All" ? "All Platforms" : p}
              </option>
            ))}
          </select>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
            {filteredWebsites.length} of {websites.length} website{websites.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="dash-panel">
        {websites.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No enabled websites. Add or enable one from the Websites page.</p>
        ) : filteredWebsites.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No websites match the current filters.</p>
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
              {filteredWebsites.map((w) => {
                const scanning = scanningIds.has(w.Id);
                const scannedToday = w.LatestScanDate && new Date(w.LatestScanDate).toDateString() === new Date().toDateString();
                const nextScanLabel = scannedToday ? "Tomorrow (~02:00)" : "Today (~02:00)";
                const typeInfo = scanTypeInfo(w.ScheduleType);
                return (
                  <tr key={w.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <Link href={`/dashboard/audit/website-security/${w.Id}`} style={{ color: "var(--series-1)", textDecoration: "none" }}>
                        {w.Name}
                      </Link>
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
