"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export interface TicketDetailData {
  Id: number;
  TicketNumber: string;
  Name: string;
  Email: string;
  Subject: string;
  Category: string;
  Priority: string;
  Status: string;
  Description: string;
  AttachmentPath: string | null;
  AttachmentOriginalName: string | null;
  CreatedAt: string;
}

export interface TicketNote {
  Id: number;
  Message: string;
  IsInternal: boolean;
  CreatedAt: string;
  AuthorUsername: string | null;
}

const STATUS_TONE: Record<string, "info" | "warning" | "success" | "neutral"> = {
  open: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "neutral",
};

const STATUSES = ["open", "in_progress", "resolved", "closed"];

export function TicketDetail({ ticket, notes }: { ticket: TicketDetailData; notes: TicketNote[] }) {
  const router = useRouter();
  const [status, setStatus] = useState(ticket.Status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [message, setMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  async function changeStatus(next: string) {
    setStatus(next);
    setSavingStatus(true);
    try {
      await fetch(`/api/admin/website/tickets/${ticket.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setSavingStatus(false);
    }
  }

  async function submitNote(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/admin/website/tickets/${ticket.Id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, isInternal }),
      });
      setMessage("");
      setIsInternal(false);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 style={{ fontSize: "1.05rem", margin: 0 }}>{ticket.Subject}</h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", margin: "0.2rem 0 0" }}>
              {ticket.Name} &lt;{ticket.Email}&gt; · {ticket.Category} · {ticket.Priority} priority · {ticket.CreatedAt.replace("T", " ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace("_", " ")}</Badge>
            <select
              value={status}
              disabled={savingStatus}
              onChange={(e) => changeStatus(e.target.value)}
              style={{
                padding: "0.35rem 0.5rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--ink)",
                fontSize: "0.8rem",
              }}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem", color: "var(--ink)" }}>{ticket.Description}</p>
        {ticket.AttachmentPath && (
          <a
            href={`/api/admin/website/tickets/${ticket.Id}/attachment`}
            className="flex items-center gap-1"
            style={{ fontSize: "0.82rem", color: "var(--primary)", width: "fit-content" }}
          >
            <Paperclip size={14} /> {ticket.AttachmentOriginalName ?? "Download attachment"}
          </a>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 style={{ fontSize: "0.95rem", margin: 0 }}>Notes & Replies</h3>
        {notes.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No notes yet.</p>}
        {notes.map((n) => (
          <div
            key={n.Id}
            style={{
              padding: "0.6rem 0.8rem",
              borderRadius: 10,
              background: n.IsInternal ? "color-mix(in srgb, var(--warning) 12%, transparent)" : "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-2" style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginBottom: "0.25rem" }}>
              <strong style={{ color: "var(--ink)" }}>{n.AuthorUsername ?? "System"}</strong>
              {n.IsInternal && <Badge tone="warning">internal note</Badge>}
              <span>{n.CreatedAt.replace("T", " ")}</span>
            </div>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>{n.Message}</p>
          </div>
        ))}

        <form onSubmit={submitNote} className="flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a reply to the submitter, or an internal note..."
            rows={3}
            style={{
              width: "100%",
              padding: "0.5rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              fontSize: "0.85rem",
              resize: "vertical",
            }}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2" style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>
              <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} />
              Internal note only (submitter is not emailed)
            </label>
            <Button type="submit" size="sm" disabled={sending || !message.trim()}>
              {sending ? "Sending..." : isInternal ? "Add internal note" : "Send reply"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
