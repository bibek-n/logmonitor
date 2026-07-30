"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Settings {
  passwordDueSoonDays: number;
  patchDueSoonDays: number;
  maintenanceDueSoonDays: number;
  warrantyExpiryWarningDays: number;
  licenceExpiryWarningDays: number;
  inventoryCheckIntervalDays: number;
  emailAlertsEnabled: boolean;
  notificationFrequency: string;
}

const inputStyle = { padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", width: 120 };
const labelStyle = { fontSize: "0.85rem", color: "var(--ink-muted)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--grid)" };

function SettingsInner() {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/it-asset-logsheet/settings");
      const data = await res.json();
      if (res.ok && data.ok) setSettings(data.data);
    })();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    const res = await fetch("/api/admin/it-asset-logsheet/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Save failed." });
      return;
    }
    toast.show({ type: "success", message: "Settings saved." });
  }

  if (!settings) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  return (
    <Card>
      <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Alert Thresholds</h3>
      <div style={labelStyle}>
        <span>Password "Due Soon" threshold (days before expiry)</span>
        <input type="number" style={inputStyle} value={settings.passwordDueSoonDays} onChange={(e) => set("passwordDueSoonDays", Number(e.target.value))} />
      </div>
      <div style={labelStyle}>
        <span>Patch "Due Soon" threshold (days)</span>
        <input type="number" style={inputStyle} value={settings.patchDueSoonDays} onChange={(e) => set("patchDueSoonDays", Number(e.target.value))} />
      </div>
      <div style={labelStyle}>
        <span>Maintenance "Due Soon" threshold (days)</span>
        <input type="number" style={inputStyle} value={settings.maintenanceDueSoonDays} onChange={(e) => set("maintenanceDueSoonDays", Number(e.target.value))} />
      </div>
      <div style={labelStyle}>
        <span>Warranty expiry warning (days before)</span>
        <input type="number" style={inputStyle} value={settings.warrantyExpiryWarningDays} onChange={(e) => set("warrantyExpiryWarningDays", Number(e.target.value))} />
      </div>
      <div style={labelStyle}>
        <span>Licence expiry warning (days before)</span>
        <input type="number" style={inputStyle} value={settings.licenceExpiryWarningDays} onChange={(e) => set("licenceExpiryWarningDays", Number(e.target.value))} />
      </div>
      <div style={labelStyle}>
        <span>Inventory check interval (days)</span>
        <input type="number" style={inputStyle} value={settings.inventoryCheckIntervalDays} onChange={(e) => set("inventoryCheckIntervalDays", Number(e.target.value))} />
      </div>
      <div style={{ ...labelStyle, borderBottom: "none" }}>
        <span>Email alerts enabled</span>
        <input type="checkbox" checked={settings.emailAlertsEnabled} onChange={(e) => set("emailAlertsEnabled", e.target.checked)} />
      </div>
      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
      </div>
    </Card>
  );
}

export function SettingsClient() {
  return (
    <ToastProvider>
      <SettingsInner />
    </ToastProvider>
  );
}
