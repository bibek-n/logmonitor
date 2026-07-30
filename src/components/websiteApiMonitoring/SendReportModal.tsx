"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface AlertContact {
  Id: number;
  Name: string;
  ContactType: string;
  Destination: string;
  IsActive: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,\n;]/)
        .map((e) => e.trim())
        .filter(Boolean)
    ),
  ];
}

export function SendReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [contacts, setContacts] = useState<AlertContact[] | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
  const [emailsRaw, setEmailsRaw] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setContacts(null);
    setSelectedContactIds(new Set());
    setEmailsRaw("");
    fetch("/api/admin/monitoring/alert-contacts")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setContacts((d.data as AlertContact[]).filter((c) => c.ContactType === "Email" && c.IsActive));
        else setContacts([]);
      })
      .catch(() => setContacts([]));
  }, [open]);

  function toggleContact(id: number) {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const adHocEmails = parseEmails(emailsRaw);
  const invalidEmails = adHocEmails.filter((e) => !EMAIL_RE.test(e));
  const totalRecipients = selectedContactIds.size + adHocEmails.filter((e) => EMAIL_RE.test(e)).length;
  const canSend = totalRecipients > 0 && invalidEmails.length === 0 && !sending;

  async function sendReport() {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/monitoring/websites/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: [...selectedContactIds], emails: adHocEmails }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to send report.");
      const { recipientCount, success } = data.data as { recipientCount: number; success: boolean };
      if (success) {
        toast.show({ type: "success", message: `Report sent to ${recipientCount} recipient${recipientCount === 1 ? "" : "s"}.` });
        onClose();
      } else {
        toast.show({ type: "error", message: "Report could not be delivered - check SMTP settings and try again." });
      }
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to send report." });
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Email Report"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={sendReport} disabled={!canSend}>
            {sending ? "Sending..." : `Send Report${totalRecipients > 0 ? ` (${totalRecipients})` : ""}`}
          </Button>
        </>
      }
    >
      <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem", marginTop: 0 }}>
        Sends a one-time status report for every website monitor - name, URL, status, 7-day uptime, last response time,
        last checked, and open incidents - to the recipients you pick below.
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.4rem" }}>Alert Contacts</div>
        {contacts === null ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
        ) : contacts.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No active email alert contacts yet - add one below.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {contacts.map((c) => (
              <label
                key={c.Id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.4rem 0.6rem",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: selectedContactIds.has(c.Id) ? "color-mix(in srgb, var(--sidebar-accent, var(--series-1)) 10%, transparent)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={selectedContactIds.has(c.Id)} onChange={() => toggleContact(c.Id)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "0.86rem", fontWeight: 600 }}>{c.Name}</div>
                  <div style={{ fontSize: "0.76rem", color: "var(--ink-muted)", fontFamily: "monospace" }}>{c.Destination}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.4rem", display: "block" }}>
          Other email address(es)
        </label>
        <textarea
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
          placeholder="one@example.com, another@example.com"
          rows={2}
          style={{
            width: "100%",
            padding: "0.5rem 0.7rem",
            borderRadius: 8,
            border: `1px solid ${invalidEmails.length > 0 ? "var(--danger)" : "var(--border)"}`,
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: "0.85rem",
            resize: "vertical",
          }}
        />
        <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
          Separate multiple addresses with a comma, semicolon, or new line. Not saved as an alert contact.
        </p>
        {invalidEmails.length > 0 && (
          <p style={{ fontSize: "0.75rem", color: "var(--danger)", marginTop: "0.2rem" }}>
            Not a valid email address: {invalidEmails.join(", ")}
          </p>
        )}
      </div>
    </Modal>
  );
}
