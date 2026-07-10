"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import type { SmtpSettingsData } from "@/app/api/admin/settings/smtp/route";

interface EmailLogRow {
  Id: number;
  ToAddress: string;
  Subject: string | null;
  Success: boolean;
  ErrorMessage: string | null;
  CreatedAt: string;
}

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

export function SmtpEmailSection({ initialData, initialLogs }: { initialData: SmtpSettingsData | null; initialLogs: EmailLogRow[] }) {
  const t = useTranslations("settings.smtpEmail");
  const toast = useToast();
  const [form, setForm] = useState({
    host: initialData?.Host ?? "",
    port: initialData?.Port ? String(initialData.Port) : "587",
    username: initialData?.Username ?? "",
    password: "",
    encryption: initialData?.Encryption ?? "TLS",
    senderName: initialData?.SenderName ?? "",
    senderEmail: initialData?.SenderEmail ?? "",
    replyTo: initialData?.ReplyTo ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState({
    lastTestAt: initialData?.LastTestAt ?? null,
    lastTestSuccess: initialData?.LastTestSuccess ?? null,
    lastTestMessage: initialData?.LastTestMessage ?? null,
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/smtp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, port: Number(form.port) || 587, password: form.password || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("saveFailedError"));
      toast.show({ type: "success", message: t("smtpSettingsSavedToast") });
      setForm((f) => ({ ...f, password: "" }));
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("somethingWentWrongError") });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testEmail.trim()) {
      toast.show({ type: "error", message: t("enterRecipientEmailError") });
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/admin/settings/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      const data = await res.json();
      setStatus({ lastTestAt: new Date().toISOString(), lastTestSuccess: data.ok, lastTestMessage: data.message ?? null });
      toast.show({ type: data.ok ? "success" : "error", message: data.message ?? (data.ok ? t("testEmailSentToast") : t("testEmailFailedToast")) });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : t("somethingWentWrongError") });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h2>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-smtp-host">
            <label style={labelStyle}>{t("smtpHostLabel")}</label>
            <input style={fieldStyle} value={form.host} onChange={(e) => set("host", e.target.value)} placeholder={t("smtpHostPlaceholder")} />
          </div>
          <div id="field-smtp-port">
            <label style={labelStyle}>{t("smtpPortLabel")}</label>
            <input style={fieldStyle} type="number" value={form.port} onChange={(e) => set("port", e.target.value)} placeholder={t("smtpPortPlaceholder")} />
          </div>
          <div id="field-encryption-type">
            <label style={labelStyle}>{t("encryptionTypeLabel")}</label>
            <Select
              value={form.encryption}
              onChange={(v) => set("encryption", v)}
              options={[
                { label: t("encryptionTls"), value: "TLS" },
                { label: t("encryptionSsl"), value: "SSL" },
                { label: t("encryptionNone"), value: "None" },
              ]}
            />
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-smtp-username">
            <label style={labelStyle}>{t("smtpUsernameLabel")}</label>
            <input style={fieldStyle} value={form.username} onChange={(e) => set("username", e.target.value)} />
          </div>
          <div id="field-smtp-password">
            <label style={labelStyle}>{t("smtpPasswordLabel")}</label>
            <input
              style={fieldStyle}
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={initialData?.PasswordSet ? t("passwordUnchangedPlaceholder") : t("enterPasswordPlaceholder")}
            />
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-sender-name">
            <label style={labelStyle}>{t("senderNameLabel")}</label>
            <input style={fieldStyle} value={form.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder={t("senderNamePlaceholder")} />
          </div>
          <div id="field-sender-email">
            <label style={labelStyle}>{t("senderEmailLabel")}</label>
            <input style={fieldStyle} value={form.senderEmail} onChange={(e) => set("senderEmail", e.target.value)} placeholder={t("senderEmailPlaceholder")} />
          </div>
          <div id="field-reply-to">
            <label style={labelStyle}>{t("replyToLabel")}</label>
            <input style={fieldStyle} value={form.replyTo} onChange={(e) => set("replyTo", e.target.value)} placeholder={t("replyToPlaceholder")} />
          </div>
        </div>

        <div id="field-email-authentication" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          {t("emailAuthenticationNote")}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("savingButton") : t("saveChangesButton")}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3" id="field-send-test-email">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>{t("sendTestEmailTitle")}</h3>
        <div className="flex gap-2 flex-wrap">
          <input style={{ ...fieldStyle, maxWidth: 320 }} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder={t("testEmailPlaceholder")} />
          <Button onClick={handleTest} disabled={testing} variant="secondary">
            {testing ? t("sendingButton") : t("sendTestEmailButton")}
          </Button>
        </div>
        <div id="field-smtp-connection-status" className="flex items-center gap-2">
          <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>{t("connectionStatusLabel")}</span>
          {status.lastTestSuccess === null ? (
            <Badge tone="neutral">{t("notTestedYet")}</Badge>
          ) : (
            <Badge tone={status.lastTestSuccess ? "success" : "danger"}>{status.lastTestSuccess ? t("connectedStatus") : t("failedStatus")}</Badge>
          )}
          {status.lastTestMessage && <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{status.lastTestMessage}</span>}
        </div>
      </Card>

      <Card className="flex flex-col gap-3" id="field-email-delivery-logs">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>{t("emailDeliveryLogsTitle")}</h3>
        <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {[
                  { key: "to", label: t("tableTo") },
                  { key: "subject", label: t("tableSubject") },
                  { key: "status", label: t("tableStatus") },
                  { key: "error", label: t("tableError") },
                  { key: "when", label: t("tableWhen") },
                ].map((h) => (
                  <th key={h.key} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialLogs.map((l) => (
                <tr key={l.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.4rem 0.6rem" }}>{l.ToAddress}</td>
                  <td style={{ padding: "0.4rem 0.6rem" }}>{l.Subject ?? "—"}</td>
                  <td style={{ padding: "0.4rem 0.6rem" }}>
                    <Badge tone={l.Success ? "success" : "danger"}>{l.Success ? t("sentStatus") : t("failedStatus")}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{l.ErrorMessage ?? "—"}</td>
                  <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{l.CreatedAt.replace("T", " ")}</td>
                </tr>
              ))}
              {initialLogs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                    {t("noEmailsSentYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
