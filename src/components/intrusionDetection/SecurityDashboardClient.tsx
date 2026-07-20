"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardStats, Severity } from "@/lib/intrusionDetection/shared";

function severityColor(s: string): string {
  if (s === "critical" || s === "high") return "var(--danger)";
  if (s === "medium" || s === "low") return "var(--warning)";
  return "var(--ink-muted)";
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 700,
        textTransform: "uppercase",
        padding: "0.2rem 0.55rem",
        borderRadius: 999,
        color: tone,
        background: `color-mix(in srgb, ${tone} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${tone} 40%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function StatTile({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div style={{ background: "var(--plane)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.75rem 1rem" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: danger ? "var(--danger)" : "var(--ink)" }}>{value}</div>
    </div>
  );
}

interface AlertRow {
  Id: number;
  RuleName: string | null;
  ProtectedApplicationName: string | null;
  Category: string;
  Severity: Severity;
  RiskScore: number;
  SourceIp: string | null;
  RequestPath: string | null;
  Status: string;
  OccurrenceCount: number;
  LastSeenAt: string;
}

interface EventRow {
  Id: number;
  DataSource: string;
  ProtectedApplicationName: string | null;
  EventTime: string;
  SourceIp: string | null;
  RequestMethod: string | null;
  RequestPath: string | null;
  ResponseStatus: number | null;
  EvidenceSummary: string | null;
  AlertId: number | null;
}

interface ProtectedApplicationRow {
  Id: number;
  Name: string;
  AppType: string;
  WebsiteId: number | null;
}

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  Enabled: boolean;
}

// Shared by the Alerts and Events tabs so both filter bars offer the same set of protected
// applications - including every website synced in from the existing Websites list, not
// just the two fixed apps (LogMonitor itself, the Sophos firewall).
function useProtectedApplications() {
  const [apps, setApps] = useState<ProtectedApplicationRow[]>([]);
  useEffect(() => {
    fetch("/api/admin/intrusion-detection/protected-applications")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setApps(d.data);
      });
  }, []);
  return apps;
}

interface RuleRow {
  Id: number;
  Name: string;
  Category: string;
  Severity: Severity;
  Enabled: boolean;
  ThresholdCount: number;
  ThresholdWindowSeconds: number;
  RecommendedAction: string | null;
}

interface ListRow {
  Id: number;
  IpOrCidr: string;
  Reason: string | null;
  CreatedAt: string;
}

const TABS = ["Alerts", "Events", "Rules", "Websites", "Website Report", "Allowlist", "Blocklist"] as const;
type Tab = (typeof TABS)[number];

export default function SecurityDashboardClient() {
  const [tab, setTab] = useState<Tab>("Alerts");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  // Set by the Website Report tab's "View Alerts"/"View Events" links - nonce forces the
  // target tab to remount with the new filter pre-applied even if the same app is clicked twice.
  const [jumpFilter, setJumpFilter] = useState<{ appId: number; nonce: number } | null>(null);

  function jumpTo(t: "Alerts" | "Events", appId: number) {
    setJumpFilter((prev) => ({ appId, nonce: (prev?.nonce ?? 0) + 1 }));
    setTab(t);
  }

  useEffect(() => {
    fetch("/api/admin/intrusion-detection/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStats(d.data);
      });
  }, []);

  return (
    <div>
      {stats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
            <StatTile label="Total Events" value={stats.totalEvents.toLocaleString()} />
            <StatTile label="Open Alerts" value={stats.openAlerts} />
            <StatTile label="Critical Alerts" value={stats.criticalAlerts} danger={stats.criticalAlerts > 0} />
            <StatTile label="Blocked IPs" value={stats.blockedIps} />
            <StatTile label="Failed Logins (24h)" value={stats.failedLogins24h} />
            <StatTile label="Requests/min" value={stats.requestsPerMinute} />
          </div>

          <div className="dash-panel" style={{ marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.6rem" }}>Collector Health</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {stats.collectorHealth.map((c) => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", padding: "0.3rem 0.6rem", border: "1px solid var(--border)", borderRadius: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: c.status === "Healthy" ? "var(--success)" : c.status === "NeverRun" ? "var(--ink-muted)" : "var(--danger)",
                    }}
                  />
                  {c.name}
                  {c.lastRunAt && <span style={{ color: "var(--ink-muted)" }}>({new Date(c.lastRunAt).toLocaleString()})</span>}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
            <TopList title="Top Attack Categories" items={stats.topCategories.map((c) => ({ label: c.category, count: c.count }))} />
            <TopList title="Top Source IPs" items={stats.topSourceIps.map((c) => ({ label: c.ip, count: c.count }))} />
            <TopList title="Most Triggered Rules" items={stats.topRules.map((c) => ({ label: c.ruleName, count: c.count }))} />
            <TopList title="Top Targeted Paths" items={stats.topPaths.map((c) => ({ label: c.path, count: c.count }))} />
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t}
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
            {t}
          </button>
        ))}
      </div>

      {tab === "Alerts" && <AlertsTab key={`alerts-${jumpFilter?.nonce ?? 0}`} initialProtectedApplicationId={jumpFilter?.appId} />}
      {tab === "Events" && <EventsTab key={`events-${jumpFilter?.nonce ?? 0}`} initialProtectedApplicationId={jumpFilter?.appId} />}
      {tab === "Rules" && <RulesTab />}
      {tab === "Websites" && <WebsitesTab />}
      {tab === "Website Report" && <WebsiteReportTab onJump={jumpTo} />}
      {tab === "Allowlist" && <IpListTab kind="allowlist" />}
      {tab === "Blocklist" && <IpListTab kind="blocklist" />}
    </div>
  );
}

function TopList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div className="dash-panel">
      <h3 style={{ fontSize: "0.85rem", marginTop: 0, marginBottom: "0.5rem" }}>{title}</h3>
      {items.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No data yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.3rem" }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{item.label}</span>
              <span style={{ color: "var(--ink-muted)" }}>{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center", fontSize: "0.82rem" }}>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}

const inputStyle = { padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", fontSize: "0.82rem" };

function AlertsTab({ initialProtectedApplicationId }: { initialProtectedApplicationId?: number } = {}) {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    severity: "",
    status: "",
    category: "",
    sourceIp: "",
    path: "",
    protectedApplicationId: initialProtectedApplicationId ? String(initialProtectedApplicationId) : "",
  });
  const apps = useProtectedApplications();

  const load = useCallback(async (p: number, f: typeof filters) => {
    setLoading(true);
    const sp = new URLSearchParams({ page: String(p), pageSize: "20" });
    Object.entries(f).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    const res = await fetch(`/api/admin/intrusion-detection/alerts?${sp}`);
    const data = await res.json();
    if (data.ok) {
      setRows(data.data);
      setTotalPages(data.pagination.totalPages);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(1, filters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <select value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))} style={inputStyle}>
          <option value="">All severities</option>
          {["informational", "low", "medium", "high", "critical"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={inputStyle}>
          <option value="">All statuses</option>
          {["New", "Investigating", "Confirmed", "FalsePositive", "Resolved", "Suppressed"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input placeholder="Category" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} style={inputStyle} />
        <input placeholder="Source IP" value={filters.sourceIp} onChange={(e) => setFilters((f) => ({ ...f, sourceIp: e.target.value }))} style={inputStyle} />
        <input placeholder="Path contains..." value={filters.path} onChange={(e) => setFilters((f) => ({ ...f, path: e.target.value }))} style={inputStyle} />
        <select value={filters.protectedApplicationId} onChange={(e) => setFilters((f) => ({ ...f, protectedApplicationId: e.target.value }))} style={inputStyle}>
          <option value="">All protected apps</option>
          {apps.map((app) => (
            <option key={app.Id} value={app.Id}>
              {app.WebsiteId ? `🌐 ${app.Name}` : app.Name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No alerts match these filters.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Severity</th>
                <th style={{ padding: "0.4rem" }}>Rule</th>
                <th style={{ padding: "0.4rem" }}>Protected App</th>
                <th style={{ padding: "0.4rem" }}>Category</th>
                <th style={{ padding: "0.4rem" }}>Risk</th>
                <th style={{ padding: "0.4rem" }}>Source IP</th>
                <th style={{ padding: "0.4rem" }}>Path</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}>Count</th>
                <th style={{ padding: "0.4rem" }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone={severityColor(a.Severity)}>{a.Severity}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem" }}>
                    <Link href={`/dashboard/security/alerts/${a.Id}`} style={{ color: "var(--primary)" }}>
                      {a.RuleName ?? "Unknown rule"}
                    </Link>
                  </td>
                  <td style={{ padding: "0.4rem" }}>{a.ProtectedApplicationName ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{a.Category}</td>
                  <td style={{ padding: "0.4rem" }}>{a.RiskScore}</td>
                  <td style={{ padding: "0.4rem" }}>{a.SourceIp ?? "-"}</td>
                  <td style={{ padding: "0.4rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.RequestPath ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{a.Status}</td>
                  <td style={{ padding: "0.4rem" }}>{a.OccurrenceCount}</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(a.LastSeenAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={page}
        totalPages={totalPages}
        onChange={(p) => {
          setPage(p);
          load(p, filters);
        }}
      />
    </div>
  );
}

function EventsTab({ initialProtectedApplicationId }: { initialProtectedApplicationId?: number } = {}) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    sourceIp: "",
    dataSource: "",
    path: "",
    protectedApplicationId: initialProtectedApplicationId ? String(initialProtectedApplicationId) : "",
  });
  const apps = useProtectedApplications();

  const load = useCallback(async (p: number, f: typeof filters) => {
    setLoading(true);
    const sp = new URLSearchParams({ page: String(p), pageSize: "25" });
    Object.entries(f).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    const res = await fetch(`/api/admin/intrusion-detection/events?${sp}`);
    const data = await res.json();
    if (data.ok) {
      setRows(data.data);
      setTotalPages(data.pagination.totalPages);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(1, filters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <select value={filters.dataSource} onChange={(e) => setFilters((f) => ({ ...f, dataSource: e.target.value }))} style={inputStyle}>
          <option value="">All sources</option>
          <option value="sophos_threat">Sophos Threat</option>
          <option value="sophos_webfilter">Sophos Web Filter</option>
          <option value="admin_audit_log">Login Activity</option>
          <option value="iis_access_log">IIS Access Log</option>
        </select>
        <input placeholder="Source IP" value={filters.sourceIp} onChange={(e) => setFilters((f) => ({ ...f, sourceIp: e.target.value }))} style={inputStyle} />
        <input placeholder="Path contains..." value={filters.path} onChange={(e) => setFilters((f) => ({ ...f, path: e.target.value }))} style={inputStyle} />
        <select value={filters.protectedApplicationId} onChange={(e) => setFilters((f) => ({ ...f, protectedApplicationId: e.target.value }))} style={inputStyle}>
          <option value="">All protected apps</option>
          {apps.map((app) => (
            <option key={app.Id} value={app.Id}>
              {app.WebsiteId ? `🌐 ${app.Name}` : app.Name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No events match these filters.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Time</th>
                <th style={{ padding: "0.4rem" }}>Source</th>
                <th style={{ padding: "0.4rem" }}>Protected App</th>
                <th style={{ padding: "0.4rem" }}>IP</th>
                <th style={{ padding: "0.4rem" }}>Method</th>
                <th style={{ padding: "0.4rem" }}>Path</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}>Alert</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(e.EventTime).toLocaleString()}</td>
                  <td style={{ padding: "0.4rem" }}>{e.DataSource}</td>
                  <td style={{ padding: "0.4rem" }}>{e.ProtectedApplicationName ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{e.SourceIp ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{e.RequestMethod ?? "-"}</td>
                  <td style={{ padding: "0.4rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.RequestPath ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>{e.ResponseStatus ?? "-"}</td>
                  <td style={{ padding: "0.4rem" }}>
                    {e.AlertId ? (
                      <Link href={`/dashboard/security/alerts/${e.AlertId}`} style={{ color: "var(--primary)" }}>
                        #{e.AlertId}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={page}
        totalPages={totalPages}
        onChange={(p) => {
          setPage(p);
          load(p, filters);
        }}
      />
    </div>
  );
}

function RulesTab() {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/intrusion-detection/rules")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRules(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function toggle(rule: RuleRow) {
    await fetch(`/api/admin/intrusion-detection/rules/${rule.Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.Enabled }),
    });
    load();
  }

  if (loading) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div className="dash-panel">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.4rem" }}>Rule</th>
              <th style={{ padding: "0.4rem" }}>Category</th>
              <th style={{ padding: "0.4rem" }}>Severity</th>
              <th style={{ padding: "0.4rem" }}>Threshold</th>
              <th style={{ padding: "0.4rem" }}>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.4rem" }}>
                  <div style={{ fontWeight: 500 }}>{r.Name}</div>
                  {r.RecommendedAction && <div style={{ color: "var(--ink-muted)", fontSize: "0.74rem" }}>{r.RecommendedAction}</div>}
                </td>
                <td style={{ padding: "0.4rem" }}>{r.Category}</td>
                <td style={{ padding: "0.4rem" }}>
                  <Badge tone={severityColor(r.Severity)}>{r.Severity}</Badge>
                </td>
                <td style={{ padding: "0.4rem" }}>
                  {r.ThresholdCount} / {r.ThresholdWindowSeconds}s
                </td>
                <td style={{ padding: "0.4rem" }}>
                  <button
                    type="button"
                    onClick={() => toggle(r)}
                    style={{
                      padding: "0.25rem 0.7rem",
                      borderRadius: 999,
                      border: "1px solid var(--border)",
                      background: r.Enabled ? "var(--success)" : "var(--plane)",
                      color: r.Enabled ? "#fff" : "var(--ink-muted)",
                      cursor: "pointer",
                      fontSize: "0.78rem",
                    }}
                  >
                    {r.Enabled ? "Enabled" : "Disabled"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WebsitesTab() {
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [otherApps, setOtherApps] = useState<ProtectedApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/intrusion-detection/websites").then((r) => r.json()),
      fetch("/api/admin/intrusion-detection/protected-applications").then((r) => r.json()),
    ])
      .then(([websiteData, appData]) => {
        if (websiteData.ok) setWebsites(websiteData.data);
        if (appData.ok) setOtherApps(appData.data.filter((a: ProtectedApplicationRow) => !a.WebsiteId));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/admin/intrusion-detection/websites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), url: url.trim() }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to add website.");
      return;
    }
    setName("");
    setUrl("");
    load();
  }

  function startEdit(w: WebsiteRow) {
    setEditingId(w.Id);
    setEditName(w.Name);
    setEditUrl(w.Url);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(id: number) {
    setEditError(null);
    setRowBusyId(id);
    const res = await fetch(`/api/admin/intrusion-detection/websites/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), url: editUrl.trim() }),
    });
    const data = await res.json();
    setRowBusyId(null);
    if (!res.ok || !data.ok) {
      setEditError(data.error ?? "Failed to save changes.");
      return;
    }
    setEditingId(null);
    load();
  }

  async function toggleEnabled(w: WebsiteRow) {
    setRowBusyId(w.Id);
    await fetch(`/api/admin/intrusion-detection/websites/${w.Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !w.Enabled }),
    });
    setRowBusyId(null);
    load();
  }

  async function remove(id: number) {
    setRowBusyId(id);
    await fetch(`/api/admin/intrusion-detection/websites/${id}`, { method: "DELETE" });
    setRowBusyId(null);
    load();
  }

  return (
    <div className="dash-panel">
      <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginTop: 0 }}>
        Websites managed here are shared with Audit Websites &amp; SSL Certificates (Security Headers, WP Scan, Website Speed &amp; Performance run
        against the same list). Changes are picked up by intrusion detection immediately - disabling a website stops new detection for it while
        keeping its history, and only enabled websites are monitored.
      </p>
      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <input placeholder="Website name" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
        <input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        />
        <button type="submit" className="submit" disabled={submitting} style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}>
          {submitting ? "Adding..." : "Add Website"}
        </button>
      </form>
      {error && (
        <div className="error" style={{ marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}
      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : websites.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No websites added yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Name</th>
                <th style={{ padding: "0.4rem" }}>URL</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }} />
              </tr>
            </thead>
            <tbody>
              {websites.map((w) => {
                const isEditing = editingId === w.Id;
                const busy = rowBusyId === w.Id;
                return (
                  <tr key={w.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    {isEditing ? (
                      <>
                        <td style={{ padding: "0.4rem" }}>
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
                        </td>
                        <td style={{ padding: "0.4rem" }}>
                          <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
                        </td>
                        <td style={{ padding: "0.4rem" }}>
                          <Badge tone={w.Enabled ? "var(--success)" : "var(--ink-muted)"}>{w.Enabled ? "Enabled" : "Disabled"}</Badge>
                        </td>
                        <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                          <button type="button" onClick={() => saveEdit(w.Id)} disabled={busy} style={{ marginRight: "0.4rem" }}>
                            {busy ? "Saving..." : "Save"}
                          </button>
                          <button type="button" onClick={cancelEdit} disabled={busy}>
                            Cancel
                          </button>
                          {editError && (
                            <div className="error" style={{ marginTop: "0.3rem", fontSize: "0.72rem" }}>
                              {editError}
                            </div>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "0.4rem" }}>{w.Name}</td>
                        <td style={{ padding: "0.4rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <a href={w.Url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>
                            {w.Url}
                          </a>
                        </td>
                        <td style={{ padding: "0.4rem" }}>
                          <Badge tone={w.Enabled ? "var(--success)" : "var(--ink-muted)"}>{w.Enabled ? "Enabled" : "Disabled"}</Badge>
                        </td>
                        <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                          <button type="button" onClick={() => startEdit(w)} disabled={busy} style={{ marginRight: "0.4rem" }}>
                            Edit
                          </button>
                          <button type="button" onClick={() => toggleEnabled(w)} disabled={busy} style={{ marginRight: "0.4rem" }}>
                            {busy ? "..." : w.Enabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(w.Id)}
                            disabled={busy}
                            style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer" }}
                          >
                            Remove
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {otherApps.length > 0 && (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: "0.75rem" }}>
          Also monitored (not from the Websites list): {otherApps.map((a) => a.Name).join(", ")}
        </p>
      )}
    </div>
  );
}

interface WebsiteReportRow {
  AppId: number;
  WebsiteName: string;
  Url: string;
  Enabled: boolean;
  EventCount: number;
  AlertCount: number;
  CriticalCount: number;
  HighCount: number;
  OpenAlertCount: number;
  LastEventAt: string | null;
  LastAlertAt: string | null;
}

// Per-website security summary - distinct from the Websites tab (which manages the list) and
// from the Alerts/Events tabs (which mix every protected application together). One row per
// website, with links that jump into Alerts/Events pre-filtered to just that site.
function WebsiteReportTab({ onJump }: { onJump: (tab: "Alerts" | "Events", appId: number) => void }) {
  const [rows, setRows] = useState<WebsiteReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/intrusion-detection/websites/report")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRows(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  if (loading) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div className="dash-panel">
      <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginTop: 0 }}>
        One row per website from the Websites list, summarizing everything intrusion detection has seen for it so far.
      </p>
      {rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No websites to report on yet - add one in the Websites tab.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Website</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}>Events</th>
                <th style={{ padding: "0.4rem" }}>Alerts</th>
                <th style={{ padding: "0.4rem" }}>Critical / High</th>
                <th style={{ padding: "0.4rem" }}>Open Alerts</th>
                <th style={{ padding: "0.4rem" }}>Last Event</th>
                <th style={{ padding: "0.4rem" }}>Last Alert</th>
                <th style={{ padding: "0.4rem" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.AppId} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>
                    <div style={{ fontWeight: 500 }}>{r.WebsiteName}</div>
                    <div style={{ color: "var(--ink-muted)", fontSize: "0.74rem" }}>{r.Url}</div>
                  </td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone={r.Enabled ? "var(--success)" : "var(--ink-muted)"}>{r.Enabled ? "Enabled" : "Disabled"}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem" }}>{r.EventCount.toLocaleString()}</td>
                  <td style={{ padding: "0.4rem" }}>{r.AlertCount.toLocaleString()}</td>
                  <td style={{ padding: "0.4rem" }}>
                    {r.CriticalCount > 0 && <Badge tone="var(--danger)">{r.CriticalCount} critical</Badge>}
                    {r.CriticalCount > 0 && r.HighCount > 0 && " "}
                    {r.HighCount > 0 && <Badge tone="var(--warning)">{r.HighCount} high</Badge>}
                    {r.CriticalCount === 0 && r.HighCount === 0 && "-"}
                  </td>
                  <td style={{ padding: "0.4rem" }}>{r.OpenAlertCount}</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{r.LastEventAt ? new Date(r.LastEventAt).toLocaleString() : "-"}</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{r.LastAlertAt ? new Date(r.LastAlertAt).toLocaleString() : "-"}</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                    <button type="button" onClick={() => onJump("Alerts", r.AppId)} style={{ marginRight: "0.4rem" }}>
                      View Alerts
                    </button>
                    <button type="button" onClick={() => onJump("Events", r.AppId)}>
                      View Events
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IpListTab({ kind }: { kind: "allowlist" | "blocklist" }) {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/intrusion-detection/${kind}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setRows(d.data);
      })
      .finally(() => setLoading(false));
  }, [kind]);

  useEffect(() => load(), [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/admin/intrusion-detection/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ipOrCidr: ip.trim(), reason: reason.trim() || null }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to add entry.");
      return;
    }
    setIp("");
    setReason("");
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/admin/intrusion-detection/${kind}/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="dash-panel">
      {kind === "blocklist" && (
        <p style={{ color: "var(--warning)", fontSize: "0.78rem", marginTop: 0 }}>
          Entries here are tracked for visibility and audit only — they do not block any traffic yet. Enforcement (Windows
          Firewall integration) is a planned Phase 2 feature, disabled by default even once built.
        </p>
      )}
      <form onSubmit={add} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <input placeholder="IP address or CIDR" value={ip} onChange={(e) => setIp(e.target.value)} required style={inputStyle} />
        <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
        <button type="submit" className="submit" style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}>
          Add
        </button>
      </form>
      {error && (
        <div className="error" style={{ marginBottom: "0.75rem" }}>
          {error}
        </div>
      )}
      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No entries yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.4rem" }}>IP / CIDR</th>
              <th style={{ padding: "0.4rem" }}>Reason</th>
              <th style={{ padding: "0.4rem" }}>Added</th>
              <th style={{ padding: "0.4rem" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.4rem" }}>{r.IpOrCidr}</td>
                <td style={{ padding: "0.4rem" }}>{r.Reason ?? "-"}</td>
                <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.CreatedAt).toLocaleString()}</td>
                <td style={{ padding: "0.4rem" }}>
                  <button
                    type="button"
                    onClick={() => remove(r.Id)}
                    style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
