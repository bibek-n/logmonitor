"use client";

import { useState } from "react";
import { Send, Users, User } from "lucide-react";

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

export function NotificationsClient({ staffOptions, initialHistory }: { staffOptions: StaffOption[]; initialHistory: NotificationHistoryRow[] }) {
  const [target, setTarget] = useState<"all" | number>("all");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);

  async function handleSend() {
    setError(null);
    setSuccess(null);
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
      setHistory((prev) => [
        {
          Id: prev[0] ? prev[0].Id + 1 : 1,
          StaffId: target === "all" ? null : target,
          StaffName: staffName,
          Message: message.trim(),
          SentByUsername: "you",
          CreatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setSuccess(target === "all" ? "Sent to all employees." : `Sent to ${staffName ?? "employee"}.`);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send notification");
    } finally {
      setSending(false);
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
        {success && !error && (
          <div className="error" style={{ background: "var(--success, #10b981)" }}>
            {success}
          </div>
        )}

        <button className="submit" onClick={handleSend} disabled={sending} style={{ width: "auto", padding: "0.5rem 1.25rem" }}>
          <span className="flex items-center gap-2">
            <Send size={14} />
            {sending ? "Sending..." : "Send Notification"}
          </span>
        </button>
      </div>

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0 }}>Recently Sent</h2>
        {history.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No notifications sent yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>To</th>
                <th style={{ padding: "0.4rem" }}>Message</th>
                <th style={{ padding: "0.4rem" }}>Sent By</th>
                <th style={{ padding: "0.4rem" }}>When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>
                    <span className="flex items-center gap-1" style={{ color: "var(--ink-muted)" }}>
                      {h.StaffId === null ? <Users size={13} /> : <User size={13} />}
                      {h.StaffId === null ? "All Employees" : h.StaffName ?? "Unknown"}
                    </span>
                  </td>
                  <td style={{ padding: "0.4rem", maxWidth: 320 }}>{h.Message}</td>
                  <td style={{ padding: "0.4rem" }}>{h.SentByUsername}</td>
                  <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{new Date(h.CreatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
