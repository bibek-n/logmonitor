"use client";

import { useState } from "react";
import { Send, Users, Bell, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

export interface StaffOption {
  Id: number;
  Name: string;
}
export interface NotificationHistoryRow {
  Id: number;
  StaffId: number | null;
  StaffName: string | null;
  Message: string;
  SentByUsername: string;
  CreatedAt: string;
}

const MAX_MESSAGE_LENGTH = 500;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsClient({ staffOptions, initialHistory }: { staffOptions: StaffOption[]; initialHistory: NotificationHistoryRow[] }) {
  const toast = useToast();
  const [target, setTarget] = useState<"all" | number>("all");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [justSentId, setJustSentId] = useState<number | null>(null);

  async function handleSend() {
    setError(null);
    if (!message.trim()) {
      setError("Message is required.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: target === "all" ? null : target, message: message.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to send notification");

      const staffName = target === "all" ? null : staffOptions.find((s) => s.Id === target)?.Name ?? null;
      const newId = (history[0]?.Id ?? 0) + 1;
      setHistory((prev) => [
        {
          Id: newId,
          StaffId: target === "all" ? null : target,
          StaffName: staffName,
          Message: message.trim(),
          SentByUsername: "you",
          CreatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setJustSentId(newId);
      setTimeout(() => setJustSentId((cur) => (cur === newId ? null : cur)), 2000);
      toast.show({ type: "success", message: target === "all" ? "Sent to all employees." : `Sent to ${staffName ?? "employee"}.` });
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send notification");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "Failed to delete." });
        return;
      }
      setHistory((prev) => prev.filter((h) => h.Id !== id));
      toast.show({ type: "success", message: "Removed from history." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete." });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="dash-panel" style={{ marginBottom: "1.5rem" }}>
        <div className="field" style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="notif-target">Send to</label>
          <select
            id="notif-target"
            value={target}
            onChange={(e) => setTarget(e.target.value === "all" ? "all" : Number(e.target.value))}
            style={{
              width: "100%",
              padding: "0.5rem 0.65rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              fontSize: "0.85rem",
            }}
          >
            <option value="all">All Employees</option>
            {staffOptions.map((s) => (
              <option key={s.Id} value={s.Id}>
                {s.Name}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ marginBottom: "0.75rem" }}>
          <label htmlFor="notif-message">Message</label>
          <textarea
            id="notif-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            rows={4}
            placeholder="Type the message that will pop up on their screen..."
            style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.9rem" }}
          />
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.25rem", textAlign: "right" }}>
            {message.length}/{MAX_MESSAGE_LENGTH}
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <button className="submit" onClick={handleSend} disabled={sending} style={{ width: "auto", padding: "0.5rem 1.25rem" }}>
          <span className="flex items-center gap-2">
            <Send size={14} />
            {sending ? "Sending..." : "Send Notification"}
          </span>
        </button>
      </div>

      <div className="dash-panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "1rem", margin: 0 }}>Recently Sent</h2>
          {history.length > 0 && <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{history.length} total</span>}
        </div>
        {history.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", padding: "2rem 0", color: "var(--ink-muted)" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={20} style={{ color: "var(--primary)" }} />
            </div>
            <p style={{ fontSize: "0.85rem", margin: 0 }}>No notifications sent yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {history.map((h) => (
              <div
                key={h.Id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.7rem",
                  padding: "0.65rem 0.75rem",
                  borderRadius: 10,
                  background: justSentId === h.Id ? "color-mix(in srgb, var(--success) 12%, var(--surface-2))" : "var(--surface-2)",
                  border: "1px solid var(--border)",
                  animation: justSentId === h.Id ? "notifPop 0.35s ease-out" : undefined,
                  transition: "background 0.6s ease",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: h.StaffId === null ? "linear-gradient(135deg, var(--warning), var(--danger))" : "linear-gradient(135deg, var(--primary), var(--info))",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                  }}
                >
                  {h.StaffId === null ? <Users size={14} /> : initials(h.StaffName ?? "?")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.15rem" }}>
                    <strong style={{ fontSize: "0.82rem", color: "var(--ink)" }}>
                      {h.StaffId === null ? "All Employees" : h.StaffName ?? "Unknown"}
                    </strong>
                    <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>· {relativeTime(h.CreatedAt)}</span>
                  </div>
                  <div style={{ fontSize: "0.83rem", color: "var(--ink-secondary)", wordBreak: "break-word" }}>{h.Message}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--ink-muted)", marginTop: "0.2rem" }}>
                    Sent by {h.SentByUsername} · {new Date(h.CreatedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(h.Id)}
                  disabled={deletingId === h.Id}
                  title="Remove from history"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "none",
                    background: "transparent",
                    color: "var(--ink-muted)",
                    cursor: "pointer",
                    flexShrink: 0,
                    opacity: deletingId === h.Id ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes notifPop {
          0% { transform: scale(0.97); opacity: 0.4; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
