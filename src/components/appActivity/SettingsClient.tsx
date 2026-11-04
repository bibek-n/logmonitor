"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Settings {
  idleTimeoutSeconds: number;
  collectWindowTitles: boolean;
  retentionDays: number;
  excludedProcessNames: string[];
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 240,
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function SettingsInner({ initial }: { initial: Settings }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [excludedText, setExcludedText] = useState(initial.excludedProcessNames.join("\n"));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const excludedProcessNames = excludedText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/app-activity/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, excludedProcessNames }),
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

  return (
    <div className="flex flex-col gap-4">
      <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Application Activity Settings</h1>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label style={{ fontSize: "0.82rem", color: "var(--ink)" }}>Idle timeout (seconds)</label>
          <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: 0 }}>
            No keyboard or mouse activity for this long counts as idle time, not productive active usage. Default: 300 (5 minutes).
          </p>
          <input
            type="number"
            min={30}
            max={3600}
            value={form.idleTimeoutSeconds}
            onChange={(e) => setForm((f) => ({ ...f, idleTimeoutSeconds: Number(e.target.value) }))}
            style={fieldStyle}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label style={{ fontSize: "0.82rem", color: "var(--ink)" }}>Data retention (days)</label>
          <input
            type="number"
            min={1}
            max={3650}
            value={form.retentionDays}
            onChange={(e) => setForm((f) => ({ ...f, retentionDays: Number(e.target.value) }))}
            style={fieldStyle}
          />
        </div>

        <Switch
          checked={form.collectWindowTitles}
          onChange={(v) => setForm((f) => ({ ...f, collectWindowTitles: v }))}
          label="Collect window titles"
        />
        <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: 0, marginTop: "-0.5rem" }}>
          Off by default. The agent never captures keystrokes, clipboard contents, or typed content - only the title bar text of
          whichever window is active, when this is enabled.
        </p>

        <div className="flex flex-col gap-1">
          <label style={{ fontSize: "0.82rem", color: "var(--ink)" }}>Excluded processes (one per line)</label>
          <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: 0 }}>
            Common OS/system processes are already filtered automatically. Add any additional process names here to exclude them
            from tracking and reports.
          </p>
          <textarea
            value={excludedText}
            onChange={(e) => setExcludedText(e.target.value)}
            rows={6}
            placeholder="e.g. onedrive.exe"
            style={{ ...fieldStyle, maxWidth: 400, fontFamily: "monospace", resize: "vertical" }}
          />
        </div>

        <Button size="sm" onClick={save} disabled={saving} style={{ width: "fit-content" }}>
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </Card>
    </div>
  );
}

export function AppActivitySettingsClient({ initial }: { initial: Settings }) {
  return (
    <ToastProvider>
      <SettingsInner initial={initial} />
    </ToastProvider>
  );
}
