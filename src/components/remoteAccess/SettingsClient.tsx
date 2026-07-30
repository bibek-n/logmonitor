"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Settings {
  vaultLockAfterMinutes: number;
  defaultConnectionTimeoutSeconds: number;
  defaultKeepaliveIntervalSeconds: number;
  connectionCheckIntervalMinutes: number;
  notifyOnConnectionOfflineContactIds: string | null;
  requireApprovalForBulkExecution: boolean;
  bulkExecutionApprovalThreshold: number;
}
interface ProtocolDiagnostic {
  id: number;
  protocol: string;
  host: string;
  port: number | null;
  status: "Reachable" | "Unreachable" | "NotSupported";
  method: string | null;
  message: string | null;
  ranAt: string;
}

const inputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", width: 140 };
const labelStyle = { display: "block", fontSize: "0.78rem", marginBottom: 4, color: "var(--ink-muted)" };

const TABS = ["General", "Protocol Diagnostics"] as const;

function SettingsInner() {
  const toast = useToast();
  const [tab, setTab] = useState<typeof TABS[number]>("General");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  const [sctpHost, setSctpHost] = useState("");
  const [sctpPort, setSctpPort] = useState("");
  const [sctpBusy, setSctpBusy] = useState(false);
  const [sctpResult, setSctpResult] = useState<{ status: string; method: string; message: string } | null>(null);
  const [diagnostics, setDiagnostics] = useState<ProtocolDiagnostic[] | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/remote-access/settings");
      const data = await res.json();
      if (res.ok && data.ok) setSettings(data.data);
    })();
  }, []);

  const loadDiagnostics = useCallback(async () => {
    const res = await fetch("/api/admin/remote-access/protocol-diagnostics/sctp");
    const data = await res.json();
    if (res.ok && data.ok) setDiagnostics(data.data);
  }, []);

  useEffect(() => {
    if (tab === "Protocol Diagnostics") loadDiagnostics();
  }, [tab, loadDiagnostics]);

  async function runSctpCheck() {
    if (!sctpHost.trim()) {
      toast.show({ type: "error", message: "Host is required." });
      return;
    }
    setSctpBusy(true);
    const res = await fetch("/api/admin/remote-access/protocol-diagnostics/sctp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: sctpHost, port: sctpPort ? Number(sctpPort) : null }),
    });
    const data = await res.json();
    setSctpBusy(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Diagnostic failed." });
      return;
    }
    setSctpResult(data.data);
    await loadDiagnostics();
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    const res = await fetch("/api/admin/remote-access/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to save settings." });
      return;
    }
    toast.show({ type: "success", message: "Settings saved." });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "0.5rem 0.8rem",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--primary)" : "2px solid transparent",
              color: tab === t ? "var(--ink)" : "var(--ink-muted)",
              cursor: "pointer",
              fontSize: "0.88rem",
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "General" ? (
        !settings ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : (
          <Card>
            <div style={{ display: "grid", gap: "1rem", maxWidth: 420 }}>
              <div>
                <label style={labelStyle}>Vault Auto-Lock After (minutes of inactivity)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={settings.vaultLockAfterMinutes}
                  onChange={(e) => setSettings({ ...settings, vaultLockAfterMinutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={labelStyle}>Default Connection Timeout (seconds)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={settings.defaultConnectionTimeoutSeconds}
                  onChange={(e) => setSettings({ ...settings, defaultConnectionTimeoutSeconds: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={labelStyle}>Default Keepalive Interval (seconds)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={settings.defaultKeepaliveIntervalSeconds}
                  onChange={(e) => setSettings({ ...settings, defaultKeepaliveIntervalSeconds: Number(e.target.value) })}
                />
              </div>
              <div>
                <label style={labelStyle}>Connection Check Interval (minutes)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={settings.connectionCheckIntervalMinutes}
                  onChange={(e) => setSettings({ ...settings, connectionCheckIntervalMinutes: Number(e.target.value) })}
                />
                <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: 4 }}>
                  Matches the interval configured on the Connection Checker Windows Scheduled Task on the server.
                </p>
              </div>
              <div>
                <label style={labelStyle}>Notify Alert Contacts on Connection Down/Recovered (comma-separated Alert Contact IDs)</label>
                <input
                  style={{ ...inputStyle, width: "100%" }}
                  value={settings.notifyOnConnectionOfflineContactIds ?? ""}
                  onChange={(e) => setSettings({ ...settings, notifyOnConnectionOfflineContactIds: e.target.value || null })}
                />
                <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: 4 }}>
                  Reuses the Slack/Teams/Webhook/In-App contacts configured under Website &amp; API Monitoring &rarr; Alert Contacts.
                </p>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={settings.requireApprovalForBulkExecution}
                    onChange={(e) => setSettings({ ...settings, requireApprovalForBulkExecution: e.target.checked })}
                  />
                  Require a second admin's approval for bulk script execution
                </label>
              </div>
              {settings.requireApprovalForBulkExecution && (
                <div>
                  <label style={labelStyle}>Approval Required Above (connections)</label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={settings.bulkExecutionApprovalThreshold}
                    onChange={(e) => setSettings({ ...settings, bulkExecutionApprovalThreshold: Number(e.target.value) })}
                  />
                </div>
              )}
              <div>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          </Card>
        )
      ) : (
        <div>
          <Card style={{ marginBottom: "1rem" }}>
            <h3 style={{ marginTop: 0, fontSize: "1rem" }}>SCTP Connectivity Diagnostics</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", maxWidth: 640 }}>
              For connectivity testing only — SCTP is never presented as a replacement for SSH, RDP, FTP, or any other
              remote-access protocol in this module. Node.js has no native SCTP socket support, and a plain TCP check
              would not be a valid substitute for a real SCTP association test, so every check here honestly reports
              &quot;not supported&quot; rather than faking a result.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <label style={labelStyle}>Host</label>
                <input value={sctpHost} onChange={(e) => setSctpHost(e.target.value)} style={{ ...inputStyle, width: 220 }} />
              </div>
              <div>
                <label style={labelStyle}>Port (optional)</label>
                <input value={sctpPort} onChange={(e) => setSctpPort(e.target.value)} style={{ ...inputStyle, width: 100 }} />
              </div>
              <Button onClick={runSctpCheck} disabled={sctpBusy}>
                {sctpBusy ? "Checking..." : "Run Check"}
              </Button>
            </div>
            {sctpResult && (
              <div style={{ marginTop: "0.8rem", padding: "0.6rem", borderRadius: 8, border: "1px solid var(--border)" }}>
                <Badge tone="warning">{sctpResult.status}</Badge>
                <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", marginTop: "0.4rem", marginBottom: 0 }}>{sctpResult.message}</p>
              </div>
            )}
          </Card>

          <div className="dash-panel">
            <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Recent Checks</h3>
            {diagnostics === null ? (
              <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
            ) : diagnostics.length === 0 ? (
              <p style={{ color: "var(--ink-muted)" }}>No diagnostic checks run yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>Host</th>
                    <th style={{ padding: "0.4rem" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.map((d) => (
                    <tr key={d.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{new Date(d.ranAt).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>
                        {d.host}
                        {d.port ? `:${d.port}` : ""}
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        <Badge tone="warning">{d.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsClient() {
  return (
    <ToastProvider>
      <SettingsInner />
    </ToastProvider>
  );
}
