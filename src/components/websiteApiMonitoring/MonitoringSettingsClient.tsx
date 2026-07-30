"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Settings {
  DefaultIntervalSeconds: number;
  DefaultTimeoutMs: number;
  DefaultFailureConfirmCount: number;
  DefaultRecoveryConfirmCount: number;
  DefaultResponseWarningMs: number;
  DefaultResponseCriticalMs: number;
  DataRetentionDays: number;
  MaxResponseSizeBytes: number;
  DefaultUserAgent: string;
  BlockPrivateNetworks: boolean;
  MaxRedirects: number;
}

const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function MonitoringSettingsInner() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/monitoring/settings")
      .then((r) => r.json())
      .then((d) => d.ok && setSettings(d.data));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/monitoring/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultIntervalSeconds: settings.DefaultIntervalSeconds,
          defaultTimeoutMs: settings.DefaultTimeoutMs,
          defaultFailureConfirmCount: settings.DefaultFailureConfirmCount,
          defaultRecoveryConfirmCount: settings.DefaultRecoveryConfirmCount,
          defaultResponseWarningMs: settings.DefaultResponseWarningMs,
          defaultResponseCriticalMs: settings.DefaultResponseCriticalMs,
          dataRetentionDays: settings.DataRetentionDays,
          maxResponseSizeBytes: settings.MaxResponseSizeBytes,
          defaultUserAgent: settings.DefaultUserAgent,
          blockPrivateNetworks: settings.BlockPrivateNetworks,
          maxRedirects: settings.MaxRedirects,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save settings.");
      toast.show({ type: "success", message: "Settings saved." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save settings." });
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>General Defaults</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Default Interval (seconds)</label>
            <input type="number" value={settings.DefaultIntervalSeconds} onChange={(e) => set("DefaultIntervalSeconds", Number(e.target.value))} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Default Timeout (ms)</label>
            <input type="number" value={settings.DefaultTimeoutMs} onChange={(e) => set("DefaultTimeoutMs", Number(e.target.value))} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Data Retention (days)</label>
            <input type="number" value={settings.DataRetentionDays} onChange={(e) => set("DataRetentionDays", Number(e.target.value))} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Default Failure Confirm Count</label>
            <input type="number" value={settings.DefaultFailureConfirmCount} onChange={(e) => set("DefaultFailureConfirmCount", Number(e.target.value))} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Default Recovery Confirm Count</label>
            <input type="number" value={settings.DefaultRecoveryConfirmCount} onChange={(e) => set("DefaultRecoveryConfirmCount", Number(e.target.value))} style={inputStyle} />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Website Monitoring Defaults</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Response-Time Warning (ms)</label>
            <input type="number" value={settings.DefaultResponseWarningMs} onChange={(e) => set("DefaultResponseWarningMs", Number(e.target.value))} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Response-Time Critical (ms)</label>
            <input type="number" value={settings.DefaultResponseCriticalMs} onChange={(e) => set("DefaultResponseCriticalMs", Number(e.target.value))} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Max Redirects</label>
            <input type="number" value={settings.MaxRedirects} onChange={(e) => set("MaxRedirects", Number(e.target.value))} style={inputStyle} />
          </div>
          <div className="field" style={{ marginBottom: 0, gridColumn: "span 2" }}>
            <label>Default User-Agent</label>
            <input value={settings.DefaultUserAgent} onChange={(e) => set("DefaultUserAgent", e.target.value)} style={inputStyle} />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Security</h3>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={settings.BlockPrivateNetworks} onChange={(e) => set("BlockPrivateNetworks", e.target.checked)} />
          Block private/loopback/link-local/metadata IP ranges (SSRF protection) — keep this enabled unless you have a specific, trusted reason to monitor an internal address.
        </label>
      </Card>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}

export function MonitoringSettingsClient() {
  return (
    <ToastProvider>
      <MonitoringSettingsInner />
    </ToastProvider>
  );
}
