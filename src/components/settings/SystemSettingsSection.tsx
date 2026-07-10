"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SystemLogsPanel } from "./SystemLogsPanel";
import type { SystemSettingsData } from "@/app/api/admin/settings/system/route";

const TIMEZONE_OPTIONS = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Kathmandu", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore"].map(
  (v) => ({ label: v, value: v })
);
const LANGUAGE_OPTIONS = [
  { label: "English", value: "en" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Nepali (नेपाली)", value: "ne" },
  { label: "Hindi (हिन्दी)", value: "hi" },
];
const DATE_FORMAT_OPTIONS = ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", "DD-MMM-YYYY"].map((v) => ({ label: v, value: v }));
const TIME_FORMAT_OPTIONS = [
  { label: "24-hour", value: "24h" },
  { label: "12-hour (AM/PM)", value: "12h" },
];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.65rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" };

export function SystemSettingsSection({ initialData, appVersion }: { initialData: SystemSettingsData | null; appVersion: string }) {
  const toast = useToast();
  const [form, setForm] = useState({
    defaultTimezone: initialData?.DefaultTimezone ?? "UTC",
    defaultLanguage: initialData?.DefaultLanguage ?? "en",
    dateFormat: initialData?.DateFormat ?? "YYYY-MM-DD",
    timeFormat: initialData?.TimeFormat ?? "24h",
    maintenanceModeEnabled: initialData?.MaintenanceModeEnabled ?? false,
    maintenanceMessage: initialData?.MaintenanceMessage ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/system", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      toast.show({
        type: form.maintenanceModeEnabled ? "info" : "success",
        message: form.maintenanceModeEnabled ? "Maintenance mode is now ON — non-admins will see the maintenance page." : "System settings saved.",
      });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4" id="field-general-settings">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>System Settings</h2>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div id="field-default-timezone">
            <label style={labelStyle}>Default Time Zone</label>
            <Select value={form.defaultTimezone} onChange={(v) => setForm((f) => ({ ...f, defaultTimezone: v }))} options={TIMEZONE_OPTIONS} />
          </div>
          <div id="field-default-language">
            <label style={labelStyle}>Default Language</label>
            <Select value={form.defaultLanguage} onChange={(v) => setForm((f) => ({ ...f, defaultLanguage: v }))} options={LANGUAGE_OPTIONS} />
          </div>
          <div id="field-date-format">
            <label style={labelStyle}>Date Format</label>
            <Select value={form.dateFormat} onChange={(v) => setForm((f) => ({ ...f, dateFormat: v }))} options={DATE_FORMAT_OPTIONS} />
          </div>
          <div id="field-time-format">
            <label style={labelStyle}>Time Format</label>
            <Select value={form.timeFormat} onChange={(v) => setForm((f) => ({ ...f, timeFormat: v }))} options={TIME_FORMAT_OPTIONS} />
          </div>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: 0 }}>
          These preferences are saved as the application default. Reformatting every existing date/time display across the app to honor them is a future phase.
        </p>

        <div id="field-maintenance-mode" className="flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <Switch checked={form.maintenanceModeEnabled} onChange={(v) => setForm((f) => ({ ...f, maintenanceModeEnabled: v }))} label="Maintenance Mode" />
          {form.maintenanceModeEnabled && (
            <>
              <textarea
                style={{ ...fieldStyle, resize: "vertical" }}
                rows={2}
                placeholder="Message shown to non-admin users while maintenance mode is on"
                value={form.maintenanceMessage}
                onChange={(e) => setForm((f) => ({ ...f, maintenanceMessage: e.target.value }))}
              />
              <p style={{ fontSize: "0.75rem", color: "var(--warning)", margin: 0 }}>
                Admins can always sign in and reach this page to turn maintenance mode back off.
              </p>
            </>
          )}
        </div>

        <div id="field-application-version" className="flex items-center gap-2">
          <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Application Version:</span>
          <Badge tone="neutral">{appVersion}</Badge>
        </div>

        <Button onClick={handleSave} disabled={saving} style={{ alignSelf: "flex-start" }}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </Card>

      <SystemLogsPanel />
    </div>
  );
}
