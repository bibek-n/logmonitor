"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Play, ExternalLink, RefreshCw, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
// Type-only imports - shared.ts also exports server-only runtime code (sql-backed filter
// builder), so only its pure `interface` types are safe to pull into this client bundle.
import type {
  WebsitePerformanceScanRow,
  WebsitePerformanceResourceMetricsRow,
  WebsiteOptimizationCheckRow,
  WebsitePerformanceConfigRow,
} from "@/lib/websitePerformance/shared";

interface WebsiteInfo {
  Id: number;
  Name: string;
  Url: string;
  Enabled: boolean;
}

interface LatestResponse {
  website: WebsiteInfo;
  config: WebsitePerformanceConfigRow | null;
  byDevice: Record<string, { scan: WebsitePerformanceScanRow | null; resources: WebsitePerformanceResourceMetricsRow | null; checks: WebsiteOptimizationCheckRow[] }>;
  latestAudit: { SecurityScore: number | null; RiskLevel: string | null; ScanDate: string | null } | null;
}

interface CompareRow {
  metric: string;
  previous: number | null;
  current: number | null;
  difference: number | null;
  changePct: number | null;
  result: string;
}

const TABS = ["Overview", "Timing Breakdown", "Core Web Vitals", "Resource Analysis", "Optimization Checks", "Comparison", "History", "Settings"] as const;
type Tab = (typeof TABS)[number];

function statusFor(score: number | null): { label: string; tone: "success" | "info" | "warning" | "danger" | "neutral" } {
  if (score === null) return { label: "Not Tested", tone: "neutral" };
  if (score >= 90) return { label: "Excellent", tone: "success" };
  if (score >= 75) return { label: "Good", tone: "info" };
  if (score >= 50) return { label: "Needs Improvement", tone: "warning" };
  return { label: "Poor", tone: "danger" };
}

function fmtMs(v: number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}
function fmtBytes(v: number | null | undefined): string {
  if (v === null || v === undefined) return "-";
  if (v >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)}MB`;
  return `${(v / 1024).toFixed(0)}KB`;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "0.35rem 0", borderBottom: "1px solid var(--grid)" }}>
      <span style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>{label}</span>
      <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function WebsitePerformanceDetailClientInner({ website }: { website: WebsiteInfo }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Overview");
  const [device, setDevice] = useState<"Mobile" | "Desktop">("Mobile");
  const [latest, setLatest] = useState<LatestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<WebsitePerformanceScanRow[]>([]);
  const [compareRows, setCompareRows] = useState<CompareRow[] | null>(null);
  const [compareAgainst, setCompareAgainst] = useState("previous");

  async function loadLatest() {
    const res = await fetch(`/api/admin/website-performance/${website.Id}/latest`);
    const data = await res.json();
    if (data.ok) setLatest(data.data);
    setLoading(false);
  }

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [website.Id]);

  useEffect(() => {
    if (tab === "History") {
      fetch(`/api/admin/website-performance/${website.Id}/history?device=${device}&pageSize=50`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setHistory(d.data);
        });
    }
    if (tab === "Comparison") {
      fetch(`/api/admin/website-performance/${website.Id}/compare?device=${device}&against=${compareAgainst}`)
        .then((r) => r.json())
        .then((d) => setCompareRows(d.ok ? d.data.rows : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, device, compareAgainst, website.Id]);

  async function runTest() {
    setRunning(true);
    try {
      const res = await fetch(`/api/admin/website-performance/${website.Id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devices: [device] }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.show({ type: "success", message: `${device} test complete.` });
        await loadLatest();
      } else {
        toast.show({ type: "error", message: data.error ?? "Test failed." });
      }
    } finally {
      setRunning(false);
    }
  }

  async function saveConfig(patch: Partial<{ enabled: boolean; testDevice: string; scheduleType: string; timeoutSeconds: number; screenshotCapture: boolean; scoreThreshold: number | null; lcpThresholdMs: number | null; clsThreshold: number | null; tbtThresholdMs: number | null; pageSizeThresholdKb: number | null; requestCountThreshold: number | null }>) {
    const cfg = latest?.config;
    const body = {
      enabled: patch.enabled ?? cfg?.Enabled ?? false,
      testDevice: patch.testDevice ?? cfg?.TestDevice ?? "Both",
      scheduleType: patch.scheduleType ?? cfg?.ScheduleType ?? "Daily",
      timeoutSeconds: patch.timeoutSeconds ?? cfg?.TimeoutSeconds ?? 60,
      screenshotCapture: patch.screenshotCapture ?? cfg?.ScreenshotCapture ?? true,
      scoreThreshold: patch.scoreThreshold !== undefined ? patch.scoreThreshold : cfg?.ScoreThreshold ?? null,
      lcpThresholdMs: patch.lcpThresholdMs !== undefined ? patch.lcpThresholdMs : cfg?.LcpThresholdMs ?? null,
      clsThreshold: patch.clsThreshold !== undefined ? patch.clsThreshold : cfg?.ClsThreshold ?? null,
      tbtThresholdMs: patch.tbtThresholdMs !== undefined ? patch.tbtThresholdMs : cfg?.TbtThresholdMs ?? null,
      pageSizeThresholdKb: patch.pageSizeThresholdKb !== undefined ? patch.pageSizeThresholdKb : cfg?.PageSizeThresholdKb ?? null,
      requestCountThreshold: patch.requestCountThreshold !== undefined ? patch.requestCountThreshold : cfg?.RequestCountThreshold ?? null,
    };
    const res = await fetch(`/api/admin/website-performance/${website.Id}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok) {
      toast.show({ type: "success", message: "Settings saved." });
      await loadLatest();
    } else {
      toast.show({ type: "error", message: data.error ?? "Failed to save settings." });
    }
  }

  if (loading) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;
  if (!latest) return <p style={{ color: "var(--danger)" }}>Failed to load performance data.</p>;

  const current = latest.byDevice[device];
  const scan = current?.scan ?? null;
  const status = statusFor(scan?.OverallScore ?? null);

  return (
    <div>
      <Link href="/dashboard/audit/website-performance" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ink-muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
        <ArrowLeft size={14} /> Back to Website Speed &amp; Performance
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>{website.Name}</h1>
          <a href={website.Url} target="_blank" rel="noreferrer" style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
            {website.Url} <ExternalLink size={11} style={{ display: "inline" }} />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <select value={device} onChange={(e) => setDevice(e.target.value as "Mobile" | "Desktop")} style={selectStyle}>
            <option value="Mobile">Mobile</option>
            <option value="Desktop">Desktop</option>
          </select>
          <button onClick={runTest} disabled={running} style={primaryBtnStyle}>
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />} Run Test
          </button>
          <a href={`/api/admin/website-performance/${website.Id}/export`} style={secondaryBtnStyle}>
            <Download size={14} /> Export CSV
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-1" style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.5rem 0.85rem",
              border: "none",
              background: "none",
              borderBottom: tab === t ? "2px solid var(--series-1)" : "2px solid transparent",
              color: tab === t ? "var(--ink)" : "var(--ink-muted)",
              fontSize: "0.83rem",
              fontWeight: tab === t ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          <Card>
            <div className="flex items-center gap-3" style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "2.2rem", fontWeight: 700 }}>{scan?.OverallScore ?? "-"}</div>
              <Badge tone={status.tone}>{status.label}</Badge>
              {!scan && <span style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No {device} test has run yet.</span>}
            </div>
            <Row label="Last Tested" value={scan?.CreatedAt ? new Date(scan.CreatedAt).toLocaleString() : "Never"} />
            <Row label="Fully Loaded Time" value={fmtMs(scan?.FullyLoadedMs)} />
            <Row label="Response Time" value={fmtMs(scan?.TotalResponseTimeMs)} />
            <Row label="Time to First Byte" value={fmtMs(scan?.TtfbMs)} />
            <Row label="Total Requests" value={current?.resources?.TotalRequests ?? "-"} />
            <Row label="Total Page Size" value={fmtBytes(current?.resources?.TotalTransferredBytes)} />
            <Row label="Core Web Vitals Score" value={scan?.CoreWebVitalsScore ?? "-"} />
          </Card>
          <div className="flex flex-col gap-4">
            <Card>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>Existing Audit &amp; SSL</h3>
              <Row label="Audit Score" value={latest.latestAudit?.SecurityScore ?? "Not scanned"} />
              <Row label="Audit Risk" value={latest.latestAudit?.RiskLevel ?? "-"} />
              <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                <Link href={`/dashboard/audit/website-security`} style={{ fontSize: "0.78rem", color: "var(--series-1)" }}>View Audit &rarr;</Link>
                <Link href={`/dashboard/audit/ssl-checker`} style={{ fontSize: "0.78rem", color: "var(--series-1)" }}>Check SSL &rarr;</Link>
              </div>
            </Card>
            {scan?.ScreenshotPath && (
              <Card>
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>Screenshot</h3>
                <img
                  src={`/api/admin/website-performance/${website.Id}/screenshot/${scan.Id}`}
                  alt={`${device} screenshot`}
                  style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
                />
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "Timing Breakdown" && (
        <Card>
          <Row label="DNS Lookup" value={fmtMs(scan?.DnsLookupMs)} />
          <Row label="TCP Connect" value={fmtMs(scan?.TcpConnectMs)} />
          <Row label="TLS Handshake" value={fmtMs(scan?.TlsHandshakeMs)} />
          <Row label="Time to First Byte" value={fmtMs(scan?.TtfbMs)} />
          <Row label="Content Download" value={fmtMs(scan?.ContentDownloadMs)} />
          <Row label="Total Response Time" value={fmtMs(scan?.TotalResponseTimeMs)} />
          <Row label="Redirect Count" value={scan?.RedirectCount ?? "-"} />
          <Row label="HTTP Status Code" value={scan?.HttpStatusCode ?? "-"} />
          <Row label="Final URL" value={scan?.FinalUrl ?? "-"} />
          <Row label="HTTP Protocol" value={scan?.HttpProtocol ?? "-"} />
          <Row label="Server IP" value={scan?.ServerIp ?? "-"} />
          <Row label="Response Size" value={fmtBytes(scan?.ResponseSizeBytes)} />
        </Card>
      )}

      {tab === "Core Web Vitals" && (
        <Card>
          <Row label="First Contentful Paint" value={fmtMs(scan?.FirstContentfulPaintMs)} />
          <Row label="Largest Contentful Paint" value={fmtMs(scan?.LargestContentfulPaintMs)} />
          <Row label="Cumulative Layout Shift" value={scan?.CumulativeLayoutShift?.toFixed(3) ?? "-"} />
          <Row label="Total Blocking Time" value={fmtMs(scan?.TotalBlockingTimeMs)} />
          <Row label="Interaction to Next Paint" value={fmtMs(scan?.InteractionToNextPaintMs)} />
          <Row label="Speed Index" value={fmtMs(scan?.SpeedIndexMs)} />
          <Row label="Time to Interactive" value={fmtMs(scan?.TimeToInteractiveMs)} />
          <Row label="DOM Content Loaded" value={fmtMs(scan?.DomContentLoadedMs)} />
          <Row label="Fully Loaded" value={fmtMs(scan?.FullyLoadedMs)} />
          <Row label="First Paint" value={fmtMs(scan?.FirstPaintMs)} />
          <Row label="Core Web Vitals Score" value={scan?.CoreWebVitalsScore ?? "-"} />
        </Card>
      )}

      {tab === "Resource Analysis" && current?.resources && (
        <Card>
          <Row label="Total Requests" value={current.resources.TotalRequests ?? "-"} />
          <Row label="Total Transferred" value={fmtBytes(current.resources.TotalTransferredBytes)} />
          <Row label="Total Uncompressed" value={fmtBytes(current.resources.TotalUncompressedBytes)} />
          <Row label="HTML" value={`${current.resources.HtmlCount ?? 0} req / ${fmtBytes(current.resources.HtmlBytes)}`} />
          <Row label="CSS" value={`${current.resources.CssCount ?? 0} req / ${fmtBytes(current.resources.CssBytes)}`} />
          <Row label="JavaScript" value={`${current.resources.JsCount ?? 0} req / ${fmtBytes(current.resources.JsBytes)}`} />
          <Row label="Images" value={`${current.resources.ImageCount ?? 0} req / ${fmtBytes(current.resources.ImageBytes)}`} />
          <Row label="Fonts" value={`${current.resources.FontCount ?? 0} req / ${fmtBytes(current.resources.FontBytes)}`} />
          <Row label="Media" value={`${current.resources.MediaCount ?? 0} req / ${fmtBytes(current.resources.MediaBytes)}`} />
          <Row label="Third-Party" value={`${current.resources.ThirdPartyCount ?? 0} req / ${fmtBytes(current.resources.ThirdPartyBytes)}`} />
          <Row label="Failed Requests" value={current.resources.FailedCount ?? 0} />
          <Row label="Redirected Requests" value={current.resources.RedirectedCount ?? 0} />
          <Row label="Render-Blocking Resources" value={current.resources.RenderBlockingCount ?? 0} />
          <Row label="Unused CSS (est.)" value={fmtBytes(current.resources.UnusedCssBytesEst)} />
          <Row label="Unused JavaScript (est.)" value={fmtBytes(current.resources.UnusedJsBytesEst)} />
          <Row label="Unoptimized Images" value={current.resources.UnoptimizedImageCount ?? 0} />
        </Card>
      )}
      {tab === "Resource Analysis" && !current?.resources && <p style={{ color: "var(--ink-muted)" }}>No resource data yet - run a {device} test.</p>}

      {tab === "Optimization Checks" && (
        <Card>
          {(current?.checks ?? []).length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>No optimization checks yet - run a {device} test.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Check</th>
                    <th style={{ padding: "0.4rem" }}>Status</th>
                    <th style={{ padding: "0.4rem" }}>Severity</th>
                    <th style={{ padding: "0.4rem" }}>Value</th>
                    <th style={{ padding: "0.4rem" }}>Est. Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {current?.checks.map((c) => (
                    <tr key={c.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}>
                        <div style={{ fontWeight: 500 }}>{c.CheckName}</div>
                        {c.Recommendation && <div style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}>{c.Recommendation}</div>}
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        <Badge tone={c.Status === "Pass" ? "success" : c.Status === "Fail" ? "danger" : c.Status === "Warning" ? "warning" : "neutral"}>{c.Status}</Badge>
                      </td>
                      <td style={{ padding: "0.4rem" }}>{c.Severity}</td>
                      <td style={{ padding: "0.4rem" }}>{c.CurrentValueText ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>
                        {c.EstimatedSavingsMs ? `${c.EstimatedSavingsMs}ms` : ""}
                        {c.EstimatedSavingsBytes ? ` ${fmtBytes(c.EstimatedSavingsBytes)}` : ""}
                        {!c.EstimatedSavingsMs && !c.EstimatedSavingsBytes && "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "Comparison" && (
        <Card>
          <div style={{ marginBottom: "0.75rem" }}>
            <select value={compareAgainst} onChange={(e) => setCompareAgainst(e.target.value)} style={selectStyle}>
              <option value="previous">vs. Previous Test</option>
              <option value="7day">vs. 7-Day Average</option>
              <option value="30day">vs. 30-Day Average</option>
              <option value="initial">vs. Initial Baseline</option>
            </select>
          </div>
          {!compareRows ? (
            <p style={{ color: "var(--ink-muted)" }}>Loading comparison...</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Metric</th>
                    <th style={{ padding: "0.4rem", textAlign: "right" }}>Previous</th>
                    <th style={{ padding: "0.4rem", textAlign: "right" }}>Current</th>
                    <th style={{ padding: "0.4rem", textAlign: "right" }}>Difference</th>
                    <th style={{ padding: "0.4rem", textAlign: "right" }}>Change %</th>
                    <th style={{ padding: "0.4rem" }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((r) => (
                    <tr key={r.metric} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}>{r.metric}</td>
                      <td style={{ padding: "0.4rem", textAlign: "right" }}>{r.previous ?? "-"}</td>
                      <td style={{ padding: "0.4rem", textAlign: "right" }}>{r.current ?? "-"}</td>
                      <td style={{ padding: "0.4rem", textAlign: "right" }}>{r.difference ?? "-"}</td>
                      <td style={{ padding: "0.4rem", textAlign: "right" }}>{r.changePct != null ? `${r.changePct}%` : "-"}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <Badge tone={r.result === "Improved" ? "success" : r.result === "Degraded" ? "danger" : r.result === "Unchanged" ? "neutral" : "info"}>{r.result}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "History" && (
        <Card>
          {history.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>No {device} test history yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Date</th>
                    <th style={{ padding: "0.4rem" }}>Status</th>
                    <th style={{ padding: "0.4rem" }}>Score</th>
                    <th style={{ padding: "0.4rem" }}>Fully Loaded</th>
                    <th style={{ padding: "0.4rem" }}>Triggered By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.filter((h) => h.Device === device).map((h) => (
                    <tr key={h.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}>{new Date(h.CreatedAt).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>{h.Status}</td>
                      <td style={{ padding: "0.4rem" }}>{h.OverallScore ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{fmtMs(h.FullyLoadedMs)}</td>
                      <td style={{ padding: "0.4rem" }}>{h.TriggeredBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "Settings" && (
        <SettingsTab config={latest.config} onSave={saveConfig} />
      )}
    </div>
  );
}

function SettingsTab({ config, onSave }: { config: WebsitePerformanceConfigRow | null; onSave: (patch: Record<string, unknown>) => void }) {
  const [enabled, setEnabled] = useState(config?.Enabled ?? false);
  const [testDevice, setTestDevice] = useState(config?.TestDevice ?? "Both");
  const [scheduleType, setScheduleType] = useState(config?.ScheduleType ?? "Daily");
  const [scoreThreshold, setScoreThreshold] = useState<string>(config?.ScoreThreshold?.toString() ?? "");
  const [lcpThresholdMs, setLcpThresholdMs] = useState<string>(config?.LcpThresholdMs?.toString() ?? "");

  return (
    <Card>
      <div className="flex flex-col gap-3" style={{ maxWidth: 420 }}>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enable scheduled performance monitoring
        </label>
        <label>
          Test Device
          <select value={testDevice} onChange={(e) => setTestDevice(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: 4 }}>
            <option value="Mobile">Mobile</option>
            <option value="Desktop">Desktop</option>
            <option value="Both">Both</option>
          </select>
        </label>
        <label>
          Schedule
          <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: 4 }}>
            <option value="Every15Min">Every 15 minutes</option>
            <option value="Every30Min">Every 30 minutes</option>
            <option value="Hourly">Hourly</option>
            <option value="Every6Hours">Every 6 hours</option>
            <option value="Every12Hours">Every 12 hours</option>
            <option value="Daily">Daily</option>
          </select>
        </label>
        <label>
          Alert: score below
          <input type="number" value={scoreThreshold} onChange={(e) => setScoreThreshold(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: 4 }} placeholder="e.g. 70" />
        </label>
        <label>
          Alert: LCP above (ms)
          <input type="number" value={lcpThresholdMs} onChange={(e) => setLcpThresholdMs(e.target.value)} style={{ ...selectStyle, width: "100%", marginTop: 4 }} placeholder="e.g. 4000" />
        </label>
        <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>
          Testing is powered by Google PageSpeed Insights, which runs its own fixed browser/location/network
          simulation - test location, browser type, and network throttling profile aren&apos;t independently
          configurable.
        </p>
        <button
          onClick={() =>
            onSave({
              enabled,
              testDevice,
              scheduleType,
              scoreThreshold: scoreThreshold ? Number(scoreThreshold) : null,
              lcpThresholdMs: lcpThresholdMs ? Number(lcpThresholdMs) : null,
            })
          }
          style={{ ...primaryBtnStyle, alignSelf: "flex-start" }}
        >
          Save Settings
        </button>
      </div>
    </Card>
  );
}

const selectStyle = { padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" };
const primaryBtnStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontSize: "0.85rem", cursor: "pointer" };
const secondaryBtnStyle = { display: "inline-flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", textDecoration: "none" };

export default function WebsitePerformanceDetailClient({ website }: { website: WebsiteInfo }) {
  return (
    <ToastProvider>
      <WebsitePerformanceDetailClientInner website={website} />
    </ToastProvider>
  );
}
