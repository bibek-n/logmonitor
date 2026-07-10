"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { DownloadCloud, DatabaseBackup } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { BackupScheduleData } from "@/app/api/admin/settings/backup/schedule/route";

interface BackupHistoryRow {
  Id: number;
  FileName: string;
  SizeBytes: number | null;
  Status: string;
  ErrorMessage: string | null;
  TriggeredByUsername: string | null;
  CreatedAt: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.83rem",
};

export function BackupDataSection({
  initialSchedule,
  initialHistory,
}: {
  initialSchedule: BackupScheduleData | null;
  initialHistory: BackupHistoryRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations("settings.backupData");
  const [schedule, setSchedule] = useState({
    backupScheduleEnabled: initialSchedule?.BackupScheduleEnabled ?? false,
    backupScheduleFrequency: initialSchedule?.BackupScheduleFrequency ?? "daily",
    backupScheduleTime: initialSchedule?.BackupScheduleTime ?? "02:00",
    backupRetentionCount: initialSchedule?.BackupRetentionCount ?? 7,
    retentionPolicyDays: initialSchedule?.RetentionPolicyDays ?? 90,
    retentionPolicyNotes: initialSchedule?.RetentionPolicyNotes ?? "",
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [confirmBackupOpen, setConfirmBackupOpen] = useState(false);

  async function saveSchedule() {
    setSavingSchedule(true);
    try {
      const res = await fetch("/api/admin/settings/backup/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("saveFailedError"));
      toast.show({ type: "success", message: t("scheduleSavedToast") });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("genericErrorToast") });
    } finally {
      setSavingSchedule(false);
    }
  }

  async function runBackup() {
    setRunningBackup(true);
    try {
      const res = await fetch("/api/admin/settings/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("backupFailedError"));
      toast.show({ type: "success", message: t("backupCompletedToast", { fileName: data.fileName }) });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("backupFailedToast") });
    } finally {
      setRunningBackup(false);
      setConfirmBackupOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3" id="field-database-backup">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setConfirmBackupOpen(true)} disabled={runningBackup}>
            <DatabaseBackup size={15} /> {runningBackup ? t("runningBackupButton") : t("runBackupButton")}
          </Button>
          <a href="/api/admin/settings/backup/export" id="field-data-export">
            <Button variant="secondary" type="button">
              <DownloadCloud size={15} /> {t("exportConfigButton")}
            </Button>
          </a>
        </div>
        <div id="field-data-restore" className="rounded-lg p-3" style={{ background: "color-mix(in srgb, var(--warning) 10%, transparent)", border: "1px solid var(--warning)" }}>
          <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{t("dataRestoreTitle")}</strong>
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
            {t.rich("dataRestoreDescription", { code: (chunks) => <code>{chunks}</code> })}
          </p>
        </div>
      </Card>

      <Card className="flex flex-col gap-3" id="field-backup-schedule">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>{t("automaticScheduleTitle")}</h3>
        <Switch checked={schedule.backupScheduleEnabled} onChange={(v) => setSchedule((s) => ({ ...s, backupScheduleEnabled: v }))} label={t("enableScheduledBackupsLabel")} />
        {schedule.backupScheduleEnabled && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Select
              value={schedule.backupScheduleFrequency}
              onChange={(v) => setSchedule((s) => ({ ...s, backupScheduleFrequency: v }))}
              options={[
                { label: t("frequencyDaily"), value: "daily" },
                { label: t("frequencyWeekly"), value: "weekly" },
                { label: t("frequencyMonthly"), value: "monthly" },
              ]}
            />
            <input style={fieldStyle} type="time" value={schedule.backupScheduleTime} onChange={(e) => setSchedule((s) => ({ ...s, backupScheduleTime: e.target.value }))} />
            <input
              style={fieldStyle}
              type="number"
              min={1}
              value={schedule.backupRetentionCount ?? ""}
              onChange={(e) => setSchedule((s) => ({ ...s, backupRetentionCount: Number(e.target.value) }))}
              placeholder={t("keepLastNBackupsPlaceholder")}
            />
          </div>
        )}
        <p style={{ fontSize: "0.75rem", color: "var(--warning)", margin: 0 }}>
          {t("scheduleNotWiredUpNotice")}
        </p>

        <div id="field-data-retention-policy" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" }}>{t("dataRetentionPolicyLabel")}</label>
          <input
            style={{ ...fieldStyle, maxWidth: 160 }}
            type="number"
            value={schedule.retentionPolicyDays ?? ""}
            onChange={(e) => setSchedule((s) => ({ ...s, retentionPolicyDays: Number(e.target.value) }))}
          />
          <textarea
            style={{ ...fieldStyle, resize: "vertical", marginTop: "0.5rem" }}
            rows={2}
            placeholder={t("retentionNotesPlaceholder")}
            value={schedule.retentionPolicyNotes ?? ""}
            onChange={(e) => setSchedule((s) => ({ ...s, retentionPolicyNotes: e.target.value }))}
          />
        </div>

        <Button onClick={saveSchedule} disabled={savingSchedule} style={{ alignSelf: "flex-start" }}>
          {savingSchedule ? t("savingButton") : t("saveChangesButton")}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3" id="field-backup-history">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>{t("backupHistoryTitle")}</h3>
        <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {[t("fileColumn"), t("sizeColumn"), t("statusColumn"), t("byColumn"), t("whenColumn")].map((h) => (
                  <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialHistory.map((b) => (
                <tr key={b.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.4rem 0.6rem" }}>{b.FileName}</td>
                  <td style={{ padding: "0.4rem 0.6rem" }}>{formatBytes(b.SizeBytes)}</td>
                  <td style={{ padding: "0.4rem 0.6rem" }}>
                    <Badge tone={b.Status === "success" ? "success" : "danger"}>{b.Status}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem 0.6rem" }}>{b.TriggeredByUsername ?? "—"}</td>
                  <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{b.CreatedAt.replace("T", " ")}</td>
                </tr>
              ))}
              {initialHistory.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                    {t("noBackupsYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmBackupOpen}
        onClose={() => setConfirmBackupOpen(false)}
        onConfirm={runBackup}
        title={t("confirmBackupTitle")}
        message={t("confirmBackupMessage")}
        confirmLabel={t("confirmBackupButton")}
        tone="primary"
        loading={runningBackup}
      />
    </div>
  );
}
