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

const TABS = ["Alerts", "Events", "Rules", "Websites", "Website Report", "Allowlist", "Blocklist", "File Integrity", "Notifications", "Response Actions"] as const;
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
      {tab === "File Integrity" && <FileIntegrityTab />}
      {tab === "Notifications" && <NotificationChannelsTab />}
      {tab === "Response Actions" && <ResponseActionsTab />}
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
          Entries added here are tracked for visibility and audit only — they do not block any traffic by themselves. For
          reviewed, reversible enforcement (a real Windows Firewall block), use the Response Actions tab instead.
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

interface FileIntegrityBaselineRow {
  id: number;
  filePath: string;
  sha256Hash: string;
  sizeBytes: number;
  lastVerifiedAt: string;
}

interface FileIntegrityEventRow {
  id: number;
  filePath: string;
  changeType: string;
  detectedAt: string;
  acknowledged: boolean;
}

function FileIntegrityTab() {
  const [baselines, setBaselines] = useState<FileIntegrityBaselineRow[]>([]);
  const [events, setEvents] = useState<FileIntegrityEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filePath, setFilePath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/intrusion-detection/file-integrity/baselines").then((r) => r.json()),
      fetch("/api/admin/intrusion-detection/file-integrity/events").then((r) => r.json()),
    ])
      .then(([b, e]) => {
        if (b.ok) setBaselines(b.data);
        if (e.ok) setEvents(e.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function addBaseline(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/intrusion-detection/file-integrity/baselines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath: filePath.trim() }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to add baseline.");
      return;
    }
    setFilePath("");
    load();
  }

  async function removeBaseline(id: number) {
    await fetch(`/api/admin/intrusion-detection/file-integrity/baselines/${id}`, { method: "DELETE" });
    load();
  }

  async function acknowledge(id: number) {
    await fetch(`/api/admin/intrusion-detection/file-integrity/events/${id}/acknowledge`, { method: "PATCH" });
    load();
  }

  async function checkNow() {
    setChecking(true);
    setCheckResult(null);
    const res = await fetch("/api/admin/intrusion-detection/file-integrity/check", { method: "POST" });
    const data = await res.json();
    setChecking(false);
    if (data.ok) {
      setCheckResult(`Checked ${data.data.checked}, unchanged ${data.data.unchanged}, modified ${data.data.modified}, deleted ${data.data.deleted}.`);
      load();
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="dash-panel">
        <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Monitored Files</h3>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
          Watches specific files on this application&apos;s own host (config files, secrets, startup scripts) for
          unexpected changes. Each add captures a SHA-256 baseline immediately; every check re-hashes and compares.
        </p>
        <form onSubmit={addBaseline} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <input
            placeholder="Absolute file path, e.g. D:\WWWROOT\LogMonitor\web.config"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            required
            style={{ ...inputStyle, flex: 1, minWidth: 320 }}
          />
          <button type="submit" className="submit" style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}>
            Add Baseline
          </button>
          <button type="button" onClick={checkNow} disabled={checking} style={{ padding: "0.4rem 1rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", cursor: "pointer", fontSize: "0.85rem" }}>
            {checking ? "Checking..." : "Check Now"}
          </button>
        </form>
        {error && <div className="error" style={{ marginBottom: "0.75rem" }}>{error}</div>}
        {checkResult && <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>{checkResult}</p>}
        {loading ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : baselines.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No files are being monitored yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>File Path</th>
                <th style={{ padding: "0.4rem" }}>SHA-256</th>
                <th style={{ padding: "0.4rem" }}>Size</th>
                <th style={{ padding: "0.4rem" }}>Last Verified</th>
                <th style={{ padding: "0.4rem" }} />
              </tr>
            </thead>
            <tbody>
              {baselines.map((b) => (
                <tr key={b.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{b.filePath}</td>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.72rem", color: "var(--ink-muted)" }}>{b.sha256Hash.slice(0, 16)}...</td>
                  <td style={{ padding: "0.4rem" }}>{b.sizeBytes.toLocaleString()} B</td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(b.lastVerifiedAt).toLocaleString()}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <button type="button" onClick={() => removeBaseline(b.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dash-panel">
        <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Change History</h3>
        {events.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No changes detected yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>File Path</th>
                <th style={{ padding: "0.4rem" }}>Change</th>
                <th style={{ padding: "0.4rem" }}>Detected</th>
                <th style={{ padding: "0.4rem" }} />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{e.filePath}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone={e.changeType === "Deleted" ? "var(--danger)" : "var(--warning)"}>{e.changeType}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(e.detectedAt).toLocaleString()}</td>
                  <td style={{ padding: "0.4rem" }}>
                    {!e.acknowledged && (
                      <button type="button" onClick={() => acknowledge(e.id)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem" }}>
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const CHANNEL_TYPE_OPTIONS = [
  { value: "slack", label: "Slack" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "webhook", label: "Generic Webhook" },
  { value: "email", label: "Email" },
  { value: "in_app", label: "In-App" },
];
const SEVERITY_OPTIONS: Severity[] = ["informational", "low", "medium", "high", "critical"];

interface NotificationChannelRow {
  id: number;
  channelType: string;
  name: string;
  enabled: boolean;
  minSeverity: Severity;
  hasConfig: boolean;
}

function NotificationChannelsTab() {
  const [channels, setChannels] = useState<NotificationChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelType, setChannelType] = useState("slack");
  const [name, setName] = useState("");
  const [minSeverity, setMinSeverity] = useState<Severity>("high");
  const [configValue, setConfigValue] = useState("");
  const [configSecret, setConfigSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<number, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/intrusion-detection/notification-channels")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setChannels(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  function buildConfig(): Record<string, string> {
    if (channelType === "slack" || channelType === "teams") return { webhookUrl: configValue };
    if (channelType === "webhook") return { url: configValue, signingSecret: configSecret };
    if (channelType === "email") return { to: configValue };
    return { username: configValue };
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/intrusion-detection/notification-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelType, name: name.trim(), minSeverity, config: buildConfig() }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to create channel.");
      return;
    }
    setName("");
    setConfigValue("");
    setConfigSecret("");
    load();
  }

  async function toggleEnabled(id: number, enabled: boolean) {
    await fetch(`/api/admin/intrusion-detection/notification-channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/admin/intrusion-detection/notification-channels/${id}`, { method: "DELETE" });
    load();
  }

  async function test(id: number) {
    const res = await fetch(`/api/admin/intrusion-detection/notification-channels/${id}/test`, { method: "POST" });
    const data = await res.json();
    setTestResult((prev) => ({ ...prev, [id]: data.ok ? "Sent successfully." : `Failed: ${data.error}` }));
  }

  const configLabel = channelType === "slack" || channelType === "teams" ? "Webhook URL" : channelType === "webhook" ? "Webhook URL" : channelType === "email" ? "Recipient email(s)" : "Username";

  return (
    <div className="dash-panel">
      <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Notification Channels</h3>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
        Every enabled channel below receives new alerts at or above its Min Severity, in addition to the default
        recipients configured in Settings &gt; Notifications. Secrets are AES-256-GCM encrypted at rest and never
        shown again after saving.
      </p>
      <form onSubmit={create} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem", alignItems: "center" }}>
        <select value={channelType} onChange={(e) => setChannelType(e.target.value)} style={inputStyle}>
          {CHANNEL_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
        <select value={minSeverity} onChange={(e) => setMinSeverity(e.target.value as Severity)} style={inputStyle}>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input placeholder={configLabel} value={configValue} onChange={(e) => setConfigValue(e.target.value)} required style={{ ...inputStyle, minWidth: 220 }} />
        {channelType === "webhook" && (
          <input placeholder="Signing secret (optional)" value={configSecret} onChange={(e) => setConfigSecret(e.target.value)} style={inputStyle} />
        )}
        <button type="submit" className="submit" style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}>
          Add Channel
        </button>
      </form>
      {error && <div className="error" style={{ marginBottom: "0.75rem" }}>{error}</div>}
      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : channels.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No notification channels configured yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.4rem" }}>Name</th>
              <th style={{ padding: "0.4rem" }}>Type</th>
              <th style={{ padding: "0.4rem" }}>Min Severity</th>
              <th style={{ padding: "0.4rem" }}>Enabled</th>
              <th style={{ padding: "0.4rem" }} />
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.4rem" }}>{c.name}</td>
                <td style={{ padding: "0.4rem" }}>{CHANNEL_TYPE_OPTIONS.find((o) => o.value === c.channelType)?.label ?? c.channelType}</td>
                <td style={{ padding: "0.4rem" }}>{c.minSeverity}</td>
                <td style={{ padding: "0.4rem" }}>
                  <input type="checkbox" checked={c.enabled} onChange={(e) => toggleEnabled(c.id, e.target.checked)} />
                </td>
                <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                  <button type="button" onClick={() => test(c.id)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem", marginRight: "0.5rem" }}>
                    Test
                  </button>
                  <button type="button" onClick={() => remove(c.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}>
                    Remove
                  </button>
                  {testResult[c.id] && <div style={{ color: "var(--ink-muted)", fontSize: "0.72rem" }}>{testResult[c.id]}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface ResponseActionRow {
  id: number;
  alertId: number | null;
  actionType: string;
  targetValue: string;
  status: string;
  dryRun: boolean;
  requestedByUsername: string | null;
  requestedAt: string;
  result: string | null;
}

function ResponseActionsTab() {
  const [actions, setActions] = useState<ResponseActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState("block_ip");
  const [targetValue, setTargetValue] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/intrusion-detection/response-actions")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setActions(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/intrusion-detection/response-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionType, targetValue: targetValue.trim(), dryRun, alertId: null }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Failed to request action.");
      return;
    }
    setTargetValue("");
    load();
  }

  async function execute(id: number) {
    setBusyId(id);
    await fetch(`/api/admin/intrusion-detection/response-actions/${id}/execute`, { method: "POST" });
    setBusyId(null);
    load();
  }

  async function rollback(id: number) {
    setBusyId(id);
    await fetch(`/api/admin/intrusion-detection/response-actions/${id}/rollback`, { method: "POST" });
    setBusyId(null);
    load();
  }

  return (
    <div className="dash-panel">
      <h3 style={{ fontSize: "0.9rem", marginTop: 0 }}>Response Actions</h3>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
        Requesting an action never does anything by itself - it always requires a separate Execute step. Block IP is
        enforced via Windows Firewall (through the existing WAF sync job); Disable Account blocks future logins but
        cannot revoke an already-active session (this app has no server-side session store). Both are reversible via
        Rollback.
      </p>
      <form onSubmit={create} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem", alignItems: "center" }}>
        <select value={actionType} onChange={(e) => setActionType(e.target.value)} style={inputStyle}>
          <option value="block_ip">Block IP</option>
          <option value="disable_account">Disable Account</option>
        </select>
        <input
          placeholder={actionType === "block_ip" ? "IP address or CIDR" : "Username"}
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          required
          style={{ ...inputStyle, minWidth: 220 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", color: "var(--ink-muted)" }}>
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry run (just record, don&apos;t execute yet)
        </label>
        <button type="submit" className="submit" style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}>
          Request
        </button>
      </form>
      {error && <div className="error" style={{ marginBottom: "0.75rem" }}>{error}</div>}
      {loading ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : actions.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No response actions requested yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.4rem" }}>Action</th>
              <th style={{ padding: "0.4rem" }}>Target</th>
              <th style={{ padding: "0.4rem" }}>Status</th>
              <th style={{ padding: "0.4rem" }}>Requested By</th>
              <th style={{ padding: "0.4rem" }}>Result</th>
              <th style={{ padding: "0.4rem" }} />
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.4rem" }}>{a.actionType === "block_ip" ? "Block IP" : "Disable Account"}</td>
                <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{a.targetValue}</td>
                <td style={{ padding: "0.4rem" }}>
                  <Badge tone={a.status === "Executed" ? "var(--success)" : a.status === "Failed" ? "var(--danger)" : "var(--ink-muted)"}>{a.status}</Badge>
                </td>
                <td style={{ padding: "0.4rem" }}>{a.requestedByUsername ?? "-"}</td>
                <td style={{ padding: "0.4rem", maxWidth: 260, fontSize: "0.76rem", color: "var(--ink-muted)" }}>{a.result ?? "-"}</td>
                <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                  {(a.status === "Pending" || a.status === "Simulated" || a.status === "Failed") && (
                    <button type="button" disabled={busyId === a.id} onClick={() => execute(a.id)} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: "0.8rem", marginRight: "0.5rem" }}>
                      Execute
                    </button>
                  )}
                  {a.status === "Executed" && (
                    <button type="button" disabled={busyId === a.id} onClick={() => rollback(a.id)} style={{ background: "none", border: "none", color: "var(--warning)", cursor: "pointer", fontSize: "0.8rem" }}>
                      Rollback
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
