"use client";

import { useState } from "react";
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      toast.show({ type: "success", message: "SMTP settings saved." });
      setForm((f) => ({ ...f, password: "" }));
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testEmail.trim()) {
      toast.show({ type: "error", message: "Enter a recipient email to send the test to." });
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
      toast.show({ type: data.ok ? "success" : "error", message: data.message ?? (data.ok ? "Test email sent." : "Test email failed.") });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>SMTP and Email Setup</h2>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-smtp-host">
            <label style={labelStyle}>SMTP Host</label>
            <input style={fieldStyle} value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.example.com" />
          </div>
          <div id="field-smtp-port">
            <label style={labelStyle}>SMTP Port</label>
            <input style={fieldStyle} type="number" value={form.port} onChange={(e) => set("port", e.target.value)} placeholder="587" />
          </div>
          <div id="field-encryption-type">
            <label style={labelStyle}>Encryption Type</label>
            <Select
              value={form.encryption}
              onChange={(v) => set("encryption", v)}
              options={[
                { label: "TLS", value: "TLS" },
                { label: "SSL", value: "SSL" },
                { label: "None", value: "None" },
              ]}
            />
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-smtp-username">
            <label style={labelStyle}>SMTP Username</label>
            <input style={fieldStyle} value={form.username} onChange={(e) => set("username", e.target.value)} />
          </div>
          <div id="field-smtp-password">
            <label style={labelStyle}>SMTP Password</label>
            <input
              style={fieldStyle}
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={initialData?.PasswordSet ? "(unchanged — enter to replace)" : "Enter password"}
            />
          </div>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div id="field-sender-name">
            <label style={labelStyle}>Sender Name</label>
            <input style={fieldStyle} value={form.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder="Log Monitor" />
          </div>
          <div id="field-sender-email">
            <label style={labelStyle}>Sender Email Address</label>
            <input style={fieldStyle} value={form.senderEmail} onChange={(e) => set("senderEmail", e.target.value)} placeholder="noreply@example.com" />
          </div>
          <div id="field-reply-to">
            <label style={labelStyle}>Reply-To Email Address</label>
            <input style={fieldStyle} value={form.replyTo} onChange={(e) => set("replyTo", e.target.value)} placeholder="support@example.com" />
          </div>
        </div>

        <div id="field-email-authentication" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          Email Authentication: SMTP AUTH LOGIN over the connection above (matches how this app's other email tools authenticate — no separate configuration needed).
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3" id="field-send-test-email">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>Send Test Email</h3>
        <div className="flex gap-2 flex-wrap">
          <input style={{ ...fieldStyle, maxWidth: 320 }} value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="recipient@example.com" />
          <Button onClick={handleTest} disabled={testing} variant="secondary">
            {testing ? "Sending..." : "Send Test Email"}
          </Button>
        </div>
        <div id="field-smtp-connection-status" className="flex items-center gap-2">
          <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Connection Status:</span>
          {status.lastTestSuccess === null ? (
            <Badge tone="neutral">Not tested yet</Badge>
          ) : (
            <Badge tone={status.lastTestSuccess ? "success" : "danger"}>{status.lastTestSuccess ? "Connected" : "Failed"}</Badge>
          )}
          {status.lastTestMessage && <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{status.lastTestMessage}</span>}
        </div>
      </Card>

      <Card className="flex flex-col gap-3" id="field-email-delivery-logs">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>Email Delivery Logs</h3>
        <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["To", "Subject", "Status", "Error", "When"].map((h) => (
                  <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                    {h}
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
                    <Badge tone={l.Success ? "success" : "danger"}>{l.Success ? "Sent" : "Failed"}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{l.ErrorMessage ?? "—"}</td>
                  <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{l.CreatedAt.replace("T", " ")}</td>
                </tr>
              ))}
              {initialLogs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                    No emails sent yet.
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
