"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Settings {
  retentionDays: number;
  collectPageTitles: boolean;
  defaultIntervalMinutes: number;
}

const inputStyle = { padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", width: 120 };
const labelStyle = { fontSize: "0.85rem", color: "var(--ink-muted)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--grid)" };

function SettingsInner({ initial }: { initial: Settings }) {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/browser-activity/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed.");
      toast.show({ type: "success", message: "Settings saved." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Browser Activity Settings</h3>
      <div style={labelStyle}>
        <span>Retention period (days before automatic deletion)</span>
        <input type="number" min={1} max={3650} style={inputStyle} value={settings.retentionDays} onChange={(e) => set("retentionDays", Number(e.target.value))} />
      </div>
      <div style={labelStyle}>
        <span>Default collection interval for newly-enabled devices (minutes)</span>
        <input type="number" min={1} max={1440} style={inputStyle} value={settings.defaultIntervalMinutes} onChange={(e) => set("defaultIntervalMinutes", Number(e.target.value))} />
      </div>
      <div style={{ ...labelStyle, borderBottom: "none" }}>
        <span>Collect page titles (when off, only domain/time/category is stored)</span>
        <input type="checkbox" checked={settings.collectPageTitles} onChange={(e) => set("collectPageTitles", e.target.checked)} />
      </div>
      <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
      </div>
    </Card>
  );
}

export function SettingsClient({ initial }: { initial: Settings }) {
  return (
    <ToastProvider>
      <SettingsInner initial={initial} />
    </ToastProvider>
  );
}
