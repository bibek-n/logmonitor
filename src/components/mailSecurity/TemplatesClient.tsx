"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface TemplateRow {
  Id: number;
  EventType: string;
  Subject: string;
  Body: string;
  UpdatedAt: string;
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

function TemplateEditor({ template, onSaved }: { template: TemplateRow; onSaved: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState(template.Subject);
  const [body, setBody] = useState(template.Body);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/mail-security/templates/${template.Id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save template.");
      toast.show({ type: "success", message: "Template saved." });
      onSaved();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save template." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ marginBottom: "1rem" }}>
      <div style={{ fontWeight: 600, marginBottom: "0.5rem" }}>{template.EventType}</div>
      <div className="field">
        <label>Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
      </div>
      <div className="field">
        <label>Body</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} style={{ ...inputStyle, fontFamily: "monospace" }} />
      </div>
      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </Card>
  );
}

function TemplatesInner() {
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/mail-security/templates");
    const data = await res.json();
    if (res.ok && data.ok) setTemplates(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (templates === null) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return <div>{templates.map((t) => <TemplateEditor key={t.Id} template={t} onSaved={load} />)}</div>;
}

export function TemplatesClient() {
  return (
    <ToastProvider>
      <TemplatesInner />
    </ToastProvider>
  );
}
