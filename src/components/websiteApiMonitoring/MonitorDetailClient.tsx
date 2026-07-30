"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDisplaySettings } from "@/lib/useDisplaySettings";
import { formatDateTime } from "@/lib/dateFormat";

type TabKey = "overview" | "history" | "responseTime" | "incidents" | "ssl" | "config" | "audit";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Check History" },
  { key: "responseTime", label: "Response Time" },
  { key: "incidents", label: "Incidents" },
  { key: "ssl", label: "SSL Certificate" },
  { key: "config", label: "Configuration" },
  { key: "audit", label: "Audit History" },
];

interface MonitorRow {
  id: number;
  name: string;
  description: string | null;
  environment: string | null;
  tags: string[];
  status: string;
  isActive: boolean;
  intervalSeconds: number;
  timeoutMs: number;
  failureConfirmCount: number;
  recoveryConfirmCount: number;
  lastCheckedAt: string | null;
  nextCheckAt: string;
  createdAt: string;
  config: {
    url: string;
    httpMethod: string;
    expectedStatusCode: number;
    followRedirects: boolean;
    maxRedirects: number;
    sslVerify: boolean;
    expectedKeyword: string | null;
    forbiddenKeyword: string | null;
    responseTimeWarningMs: number;
    responseTimeCriticalMs: number;
    alertEmail: string | null;
  };
}

interface Metrics {
  totalChecks: number;
  uptimePercent: number | null;
  currentMs: number | null;
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  p50Ms: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
}

interface HistoryRow {
  Id: number;
  CheckedAt: string;
  Success: boolean;
  HttpStatusCode: number | null;
  TotalMs: number | null;
  ErrorMessage: string | null;
}

interface IncidentRow {
  Id: number;
  Title: string;
  Severity: string;
  Status: string;
  StartedAt: string;
  ResolvedAt: string | null;
  DowntimeSeconds: number | null;
}

interface SslRow {
  Domain: string | null;
  Issuer: string | null;
  Subject: string | null;
  ValidFrom: string | null;
  ExpiresAt: string | null;
  DaysRemaining: number | null;
  HostnameMatch: boolean | null;
  ChainValid: boolean | null;
  SelfSigned: boolean | null;
  TlsProtocol: string | null;
}

const panelStyle: React.CSSProperties = { padding: "1rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)" };

export function MonitorDetailClient({ monitorId }: { monitorId: number }) {
  const displaySettings = useDisplaySettings();
  const [tab, setTab] = useState<TabKey>("overview");
  const [monitor, setMonitor] = useState<MonitorRow | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [incidents, setIncidents] = useState<IncidentRow[] | null>(null);
  const [ssl, setSsl] = useState<SslRow | null>(null);

  useEffect(() => {
    fetch(`/api/admin/monitoring/websites/${monitorId}`)
      .then((r) => r.json())
      .then((d) => d.ok && setMonitor(d.data));
    fetch(`/api/admin/monitoring/websites/${monitorId}/metrics?days=7`)
      .then((r) => r.json())
      .then((d) => d.ok && setMetrics(d.data));
  }, [monitorId]);

  useEffect(() => {
    if (tab === "history" && history === null) {
      fetch(`/api/admin/monitoring/websites/${monitorId}/history`)
        .then((r) => r.json())
        .then((d) => d.ok && setHistory(d.data));
    }
    if (tab === "incidents" && incidents === null) {
      fetch(`/api/admin/monitoring/incidents?monitorId=${monitorId}`)
        .then((r) => r.json())
        .then((d) => d.ok && setIncidents(d.data));
    }
    if (tab === "ssl" && ssl === null) {
      fetch(`/api/admin/monitoring/ssl-certificates`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            const row = (d.data as (SslRow & { MonitorId: number })[]).find((s) => s.MonitorId === monitorId);
            setSsl(row ?? ({} as SslRow));
          }
        });
    }
  }, [tab, monitorId, history, incidents, ssl]);

  if (!monitor) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{monitor.name}</h1>
        <Link href={`/dashboard/monitoring/websites/${monitorId}/edit`} style={{ color: "var(--series-1)", fontSize: "0.85rem" }}>
          Edit monitor
        </Link>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, fontFamily: "monospace" }}>{monitor.config.url}</p>

      <div style={{ display: "flex", gap: "0.4rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "0.5rem 0.8rem",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--sidebar-accent, var(--series-1))" : "2px solid transparent",
              color: tab === t.key ? "var(--ink)" : "var(--ink-muted)",
              fontWeight: tab === t.key ? 600 : 400,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={panelStyle}>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Status</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{monitor.status}</div>
          </div>
          <div style={panelStyle}>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Uptime (7d)</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{metrics?.uptimePercent != null ? `${metrics.uptimePercent.toFixed(2)}%` : "-"}</div>
          </div>
          <div style={panelStyle}>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Current Response</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{metrics?.currentMs != null ? `${metrics.currentMs}ms` : "-"}</div>
          </div>
          <div style={panelStyle}>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Avg Response (7d)</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{metrics?.avgMs != null ? `${Math.round(metrics.avgMs)}ms` : "-"}</div>
          </div>
          <div style={panelStyle}>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Total Checks (7d)</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{metrics?.totalChecks ?? "-"}</div>
          </div>
          <div style={panelStyle}>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Last Checked</div>
            <div style={{ fontSize: "1rem" }}>{monitor.lastCheckedAt ? formatDateTime(new Date(monitor.lastCheckedAt), displaySettings) : "Not yet checked"}</div>
          </div>
          <div style={panelStyle}>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Next Check</div>
            <div style={{ fontSize: "1rem" }}>{formatDateTime(new Date(monitor.nextCheckAt), displaySettings)}</div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="dash-panel">
          {history === null ? (
            <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
          ) : history.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>No checks recorded yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                    <th style={{ padding: "0.4rem" }}>Checked At</th>
                    <th style={{ padding: "0.4rem" }}>Result</th>
                    <th style={{ padding: "0.4rem" }}>HTTP Status</th>
                    <th style={{ padding: "0.4rem" }}>Response Time</th>
                    <th style={{ padding: "0.4rem" }}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{formatDateTime(new Date(h.CheckedAt), displaySettings)}</td>
                      <td style={{ padding: "0.4rem", color: h.Success ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>{h.Success ? "Success" : "Failure"}</td>
                      <td style={{ padding: "0.4rem" }}>{h.HttpStatusCode ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{h.TotalMs != null ? `${h.TotalMs}ms` : "-"}</td>
                      <td style={{ padding: "0.4rem", color: "var(--danger)" }}>{h.ErrorMessage ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "responseTime" && (
        <div className="dash-panel">
          {!metrics ? (
            <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
          ) : (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={panelStyle}>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Min</div>
                <div style={{ fontWeight: 700 }}>{metrics.minMs ?? "-"}ms</div>
              </div>
              <div style={panelStyle}>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>p50</div>
                <div style={{ fontWeight: 700 }}>{metrics.p50Ms != null ? Math.round(metrics.p50Ms) : "-"}ms</div>
              </div>
              <div style={panelStyle}>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>p90</div>
                <div style={{ fontWeight: 700 }}>{metrics.p90Ms != null ? Math.round(metrics.p90Ms) : "-"}ms</div>
              </div>
              <div style={panelStyle}>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>p95</div>
                <div style={{ fontWeight: 700 }}>{metrics.p95Ms != null ? Math.round(metrics.p95Ms) : "-"}ms</div>
              </div>
              <div style={panelStyle}>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>p99</div>
                <div style={{ fontWeight: 700 }}>{metrics.p99Ms != null ? Math.round(metrics.p99Ms) : "-"}ms</div>
              </div>
              <div style={panelStyle}>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Max</div>
                <div style={{ fontWeight: 700 }}>{metrics.maxMs ?? "-"}ms</div>
              </div>
            </div>
          )}
          <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginTop: "0.75rem" }}>Trend charts arrive in a later phase — percentiles above cover the last 7 days.</p>
        </div>
      )}

      {tab === "incidents" && (
        <div className="dash-panel">
          {incidents === null ? (
            <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
          ) : incidents.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>No incidents recorded for this monitor.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
              {incidents.map((i) => (
                <li key={i.Id} style={{ marginBottom: "0.3rem" }}>
                  <Link href={`/dashboard/monitoring/incidents/${i.Id}`} style={{ color: "var(--series-1)" }}>
                    {i.Title}
                  </Link>{" "}
                  - {i.Status} ({i.Severity}) - started {formatDateTime(new Date(i.StartedAt), displaySettings)}
                  {i.ResolvedAt ? ` - resolved ${formatDateTime(new Date(i.ResolvedAt), displaySettings)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "ssl" && (
        <div className="dash-panel">
          {ssl === null ? (
            <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
          ) : !ssl.Domain ? (
            <p style={{ color: "var(--ink-muted)" }}>No SSL certificate data yet (HTTPS monitor not yet checked, or target is HTTP-only).</p>
          ) : (
            <table style={{ fontSize: "0.85rem", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Domain</td>
                  <td style={{ padding: "0.3rem 0" }}>{ssl.Domain}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Issuer</td>
                  <td style={{ padding: "0.3rem 0" }}>{ssl.Issuer ?? "-"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Valid From</td>
                  <td style={{ padding: "0.3rem 0" }}>{ssl.ValidFrom ? new Date(ssl.ValidFrom).toLocaleDateString() : "-"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Expires At</td>
                  <td style={{ padding: "0.3rem 0", color: ssl.DaysRemaining != null && ssl.DaysRemaining <= 14 ? "var(--danger)" : undefined }}>
                    {ssl.ExpiresAt ? new Date(ssl.ExpiresAt).toLocaleDateString() : "-"} {ssl.DaysRemaining != null ? `(${ssl.DaysRemaining} days remaining)` : ""}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>TLS Protocol</td>
                  <td style={{ padding: "0.3rem 0" }}>{ssl.TlsProtocol ?? "-"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Hostname Match</td>
                  <td style={{ padding: "0.3rem 0" }}>{ssl.HostnameMatch ? "Yes" : "No"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Self-Signed</td>
                  <td style={{ padding: "0.3rem 0" }}>{ssl.SelfSigned ? "Yes" : "No"}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "config" && (
        <div className="dash-panel">
          <table style={{ fontSize: "0.85rem", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>URL</td>
                <td style={{ padding: "0.3rem 0", fontFamily: "monospace" }}>{monitor.config.url}</td>
              </tr>
              <tr>
                <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Method</td>
                <td style={{ padding: "0.3rem 0" }}>{monitor.config.httpMethod}</td>
              </tr>
              <tr>
                <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Expected Status</td>
                <td style={{ padding: "0.3rem 0" }}>{monitor.config.expectedStatusCode}</td>
              </tr>
              <tr>
                <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Interval</td>
                <td style={{ padding: "0.3rem 0" }}>{monitor.intervalSeconds}s</td>
              </tr>
              <tr>
                <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Timeout</td>
                <td style={{ padding: "0.3rem 0" }}>{monitor.timeoutMs}ms</td>
              </tr>
              <tr>
                <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Failure / Recovery Confirm Count</td>
                <td style={{ padding: "0.3rem 0" }}>
                  {monitor.failureConfirmCount} / {monitor.recoveryConfirmCount}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Environment</td>
                <td style={{ padding: "0.3rem 0" }}>{monitor.environment ?? "-"}</td>
              </tr>
              <tr>
                <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Tags</td>
                <td style={{ padding: "0.3rem 0" }}>{monitor.tags.join(", ") || "-"}</td>
              </tr>
              <tr>
                <td style={{ padding: "0.3rem 1rem 0.3rem 0", color: "var(--ink-muted)" }}>Alert Email</td>
                <td style={{ padding: "0.3rem 0" }}>{monitor.config.alertEmail || "- (uses Alert Policy contacts only)"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {tab === "audit" && (
        <div className="dash-panel">
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
            Configuration changes to this monitor are recorded in the system-wide admin audit log (module: monitoring).
          </p>
        </div>
      )}
    </div>
  );
}
