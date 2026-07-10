"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface Preferences {
  EmailEnabled: boolean;
  SmsEnabled: boolean;
  PushEnabled: boolean;
  InAppEnabled: boolean;
}
interface TemplateRow {
  Id: number;
  Key: string;
  Subject: string | null;
  Body: string | null;
  IsSystem: boolean;
}
interface RuleRow {
  Id: number;
  EventName: string;
  EmailEnabled: boolean;
  SmsEnabled: boolean;
  PushEnabled: boolean;
  InAppEnabled: boolean;
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

export function NotificationsSection({
  initialPreferences,
  initialTemplates,
  initialRules,
}: {
  initialPreferences: Preferences | null;
  initialTemplates: TemplateRow[];
  initialRules: RuleRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Preferences>(
    initialPreferences ?? { EmailEnabled: true, SmsEnabled: false, PushEnabled: false, InAppEnabled: true }
  );
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TemplateRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ key: "", subject: "", body: "" });

  async function savePreferences() {
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/admin/settings/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailEnabled: prefs.EmailEnabled,
          smsEnabled: prefs.SmsEnabled,
          pushEnabled: prefs.PushEnabled,
          inAppEnabled: prefs.InAppEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      toast.show({ type: "success", message: "Notification preferences saved." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSavingPrefs(false);
    }
  }

  async function saveTemplate() {
    if (!editTemplate) return;
    try {
      const res = await fetch(`/api/admin/settings/notifications/templates/${editTemplate.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editTemplate.Subject, body: editTemplate.Body }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Save failed");
      toast.show({ type: "success", message: "Template saved." });
      setEditTemplate(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function createTemplate() {
    if (!newTemplate.key.trim()) {
      toast.show({ type: "error", message: "Key is required." });
      return;
    }
    try {
      const res = await fetch("/api/admin/settings/notifications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Create failed");
      toast.show({ type: "success", message: "Template created." });
      setCreateOpen(false);
      setNewTemplate({ key: "", subject: "", body: "" });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function toggleRuleChannel(rule: RuleRow, channel: keyof Omit<RuleRow, "Id" | "EventName">) {
    const next = { ...rule, [channel]: !rule[channel] };
    await fetch(`/api/admin/settings/notifications/rules/${rule.Id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emailEnabled: next.EmailEnabled,
        smsEnabled: next.SmsEnabled,
        pushEnabled: next.PushEnabled,
        inAppEnabled: next.InAppEnabled,
      }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3" id="field-notification-channels">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>Notifications</h2>
        <div className="flex flex-col gap-2">
          <Switch checked={prefs.EmailEnabled} onChange={(v) => setPrefs((p) => ({ ...p, EmailEnabled: v }))} label="Email Notifications" />
          <Switch checked={prefs.SmsEnabled} onChange={(v) => setPrefs((p) => ({ ...p, SmsEnabled: v }))} label="SMS Notifications" />
          <Switch checked={prefs.PushEnabled} onChange={(v) => setPrefs((p) => ({ ...p, PushEnabled: v }))} label="Push Notifications" />
          <Switch checked={prefs.InAppEnabled} onChange={(v) => setPrefs((p) => ({ ...p, InAppEnabled: v }))} label="In-App Notifications" />
        </div>
        <Button onClick={savePreferences} disabled={savingPrefs} style={{ alignSelf: "flex-start" }}>
          {savingPrefs ? "Saving..." : "Save Changes"}
        </Button>
      </Card>

      <Card className="flex flex-col gap-3" id="field-notification-templates">
        <div className="flex items-center justify-between">
          <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>Notification Templates</h3>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Add Template
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {initialTemplates.map((t) => (
            <div key={t.Id} className="flex items-center justify-between rounded-lg p-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <div>
                <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{t.Key}</strong>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-muted)" }}>{t.Subject}</p>
              </div>
              <button onClick={() => setEditTemplate(t)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}>
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-3" id="field-notification-rules">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>Event-Based Notification Rules</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["Event", "Email", "SMS", "Push", "In-App"].map((h) => (
                  <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialRules.map((r) => (
                <tr key={r.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.4rem 0.6rem" }}>{r.EventName}</td>
                  {(["EmailEnabled", "SmsEnabled", "PushEnabled", "InAppEnabled"] as const).map((c) => (
                    <td key={c} style={{ padding: "0.4rem 0.6rem" }}>
                      <Switch checked={r[c]} onChange={() => toggleRuleChannel(r, c)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Notification Template"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={createTemplate}>
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <input style={fieldStyle} placeholder="Key (e.g. welcome_email)" value={newTemplate.key} onChange={(e) => setNewTemplate((t) => ({ ...t, key: e.target.value }))} />
          <input style={fieldStyle} placeholder="Subject" value={newTemplate.subject} onChange={(e) => setNewTemplate((t) => ({ ...t, subject: e.target.value }))} />
          <textarea style={{ ...fieldStyle, resize: "vertical" }} rows={4} placeholder="Body" value={newTemplate.body} onChange={(e) => setNewTemplate((t) => ({ ...t, body: e.target.value }))} />
        </div>
      </Modal>

      {editTemplate && (
        <Modal
          open
          onClose={() => setEditTemplate(null)}
          title={`Edit Template — ${editTemplate.Key}`}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditTemplate(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveTemplate}>
                Save
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-2">
            <input style={fieldStyle} placeholder="Subject" value={editTemplate.Subject ?? ""} onChange={(e) => setEditTemplate({ ...editTemplate, Subject: e.target.value })} />
            <textarea
              style={{ ...fieldStyle, resize: "vertical" }}
              rows={5}
              placeholder="Body"
              value={editTemplate.Body ?? ""}
              onChange={(e) => setEditTemplate({ ...editTemplate, Body: e.target.value })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
