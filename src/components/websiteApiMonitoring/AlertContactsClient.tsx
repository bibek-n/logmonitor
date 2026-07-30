"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const CONTACT_TYPES = ["Email", "Slack", "Teams", "Webhook", "InApp"] as const;
type ContactType = (typeof CONTACT_TYPES)[number];

const DESTINATION_LABEL: Record<ContactType, string> = {
  Email: "Email Address",
  Slack: "Slack Webhook URL",
  Teams: "Teams Webhook URL",
  Webhook: "Webhook URL",
  InApp: "Username",
};

const DESTINATION_PLACEHOLDER: Record<ContactType, string> = {
  Email: "ops@example.com",
  Slack: "https://hooks.slack.com/services/...",
  Teams: "https://outlook.office.com/webhook/...",
  Webhook: "https://example.com/webhook-receiver",
  InApp: "jdoe",
};

interface ContactRow {
  Id: number;
  Name: string;
  ContactType: ContactType;
  Destination: string;
  hasSigningSecret: boolean;
  VerificationStatus: string;
  IsActive: boolean;
  CreatedAt: string;
}

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function AlertContactsInner() {
  const toast = useToast();
  const [rows, setRows] = useState<ContactRow[] | null>(null);
  const [name, setName] = useState("");
  const [contactType, setContactType] = useState<ContactType>("Email");
  const [destination, setDestination] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/monitoring/alert-contacts");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim() || !destination.trim()) {
      toast.show({ type: "error", message: "Name and destination are required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/monitoring/alert-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contactType, destination, signingSecret: contactType === "Webhook" ? signingSecret || null : null, isActive: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create alert contact.");
      toast.show({ type: "success", message: "Alert contact created." });
      setName("");
      setDestination("");
      setSigningSecret("");
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to create alert contact." });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(row: ContactRow) {
    const res = await fetch(`/api/admin/monitoring/alert-contacts/${row.Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.IsActive }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to update contact." });
      return;
    }
    await load();
  }

  async function remove(row: ContactRow) {
    const res = await fetch(`/api/admin/monitoring/alert-contacts/${row.Id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to delete contact." });
      return;
    }
    toast.show({ type: "success", message: `${row.Name} deleted.` });
    await load();
  }

  async function sendTest(row: ContactRow) {
    const res = await fetch(`/api/admin/monitoring/alert-contacts/${row.Id}/test`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok || !data.data?.success) {
      toast.show({ type: "error", message: data.error ?? data.data?.error ?? "Test notification failed to send." });
      return;
    }
    toast.show({ type: "success", message: `Test notification sent via ${row.ContactType}.` });
    await load();
  }

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Contact Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Channel</label>
            <select value={contactType} onChange={(e) => setContactType(e.target.value as ContactType)} style={inputStyle}>
              {CONTACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "InApp" ? "In-App" : t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>{DESTINATION_LABEL[contactType]}</label>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} style={{ ...inputStyle, minWidth: 260 }} placeholder={DESTINATION_PLACEHOLDER[contactType]} />
          </div>
          {contactType === "Webhook" && (
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Signing Secret (optional)</label>
              <input value={signingSecret} onChange={(e) => setSigningSecret(e.target.value)} style={inputStyle} placeholder="Used to HMAC-sign the payload" />
            </div>
          )}
          <Button onClick={create} disabled={submitting}>
            Add Alert Contact
          </Button>
        </div>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: "0.5rem", marginBottom: 0 }}>
          Slack/Teams use an incoming webhook URL from that platform. Webhook posts a JSON payload to any URL you provide. In-App
          delivers to a dashboard user&apos;s notification bell by username.
        </p>
      </Card>

      <div className="dash-panel">
        {rows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No alert contacts yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Channel</th>
                  <th style={{ padding: "0.4rem" }}>Destination</th>
                  <th style={{ padding: "0.4rem" }}>Verification</th>
                  <th style={{ padding: "0.4rem" }}>Active</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{r.Name}</td>
                    <td style={{ padding: "0.4rem" }}>{r.ContactType === "InApp" ? "In-App" : r.ContactType}</td>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.Destination}</td>
                    <td style={{ padding: "0.4rem", color: r.VerificationStatus === "Verified" ? "var(--success)" : "var(--ink-muted)" }}>{r.VerificationStatus}</td>
                    <td style={{ padding: "0.4rem" }}>{r.IsActive ? "Yes" : "No"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <Button size="sm" variant="secondary" onClick={() => sendTest(r)}>
                          Send Test
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => toggleActive(r)}>
                          {r.IsActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(r)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function AlertContactsClient() {
  return (
    <ToastProvider>
      <AlertContactsInner />
    </ToastProvider>
  );
}
