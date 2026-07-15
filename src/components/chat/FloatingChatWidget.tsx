"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X, Send, ExternalLink } from "lucide-react";

interface ChatMessage {
  Id: number;
  SenderType: string;
  SenderName: string;
  Message: string;
  CreatedAt: string;
}

const POLL_MS = 5000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

// Mounted once, globally, in DashShellClient - so an incoming employee message pops open
// a real reply box right in the browser, on whatever dashboard page the admin is already
// on, instead of just a notification they have to click through to a different page.
export default function FloatingChatWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSeenIdRef = useRef<number>(-1);
  const seededRef = useRef(false);
  const openStaffIdRef = useRef<number | null>(null);
  const panelOpenRef = useRef(false);

  useEffect(() => {
    openStaffIdRef.current = staffId;
  }, [staffId]);
  useEffect(() => {
    panelOpenRef.current = open;
  }, [open]);

  async function openThread(id: number, name: string) {
    setStaffId(id);
    setStaffName(name);
    setOpen(true);
    try {
      const res = await fetch(`/api/admin/chat/${id}`);
      const data = await res.json();
      if (res.ok && data.ok) setMessages(data.messages);
    } catch {
      // transient - the live poll below will catch up
    }
  }

  // Global watch for new messages - auto-opens the box on the newest arrival when the
  // widget is closed. If it's already open on a different conversation, it deliberately
  // does NOT yank focus away - the badge count and sidebar's own red indicator still
  // reflect that something else needs attention.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/admin/chat/unread");
        if (!res.ok) return;
        const data: { ok: boolean; count: number; messages: { Id: number; StaffId: number; StaffName: string }[] } = await res.json();
        if (cancelled || !data.ok) return;
        setUnreadCount(data.count);

        if (!seededRef.current) {
          seededRef.current = true;
          if (data.messages.length > 0) lastSeenIdRef.current = Math.max(...data.messages.map((m) => m.Id));
          return;
        }

        const fresh = data.messages.filter((m) => m.Id > lastSeenIdRef.current).sort((a, b) => a.Id - b.Id);
        if (fresh.length === 0) return;
        lastSeenIdRef.current = Math.max(...fresh.map((m) => m.Id));

        const latest = fresh[fresh.length - 1];
        if (!panelOpenRef.current) {
          openThread(latest.StaffId, latest.StaffName);
        } else if (openStaffIdRef.current === latest.StaffId) {
          fetch(`/api/admin/chat/${latest.StaffId}`)
            .then((r) => r.json())
            .then((d) => {
              if (!cancelled && d.ok) setMessages(d.messages);
            })
            .catch(() => {});
        }
      } catch {
        // transient network hiccup - just try again on the next tick
      }
    }

    poll();
    const id = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Keeps the open thread live while the panel is showing (mirrors ChatClient's own poll).
  useEffect(() => {
    if (!open || !staffId) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/chat/${staffId}`);
        const data = await res.json();
        if (res.ok && data.ok) setMessages(data.messages);
      } catch {
        // transient
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [open, staffId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || !staffId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/chat/${staffId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setDraft("");
        const r2 = await fetch(`/api/admin/chat/${staffId}`);
        const d2 = await r2.json();
        if (r2.ok && d2.ok) setMessages(d2.messages);
      }
    } catch {
      // this compact widget has no error slot - the full inbox page shows failures
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => (staffId && staffName ? setOpen(true) : router.push("/dashboard/chat"))}
        aria-label="Open employee chat"
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 150,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--primary), var(--info))",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}
      >
        <MessageCircle size={22} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: "var(--danger)",
              color: "#fff",
              fontSize: "0.65rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid var(--surface)",
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 150,
        width: 340,
        height: 460,
        borderRadius: 16,
        overflow: "hidden",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "0.7rem 0.9rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.55rem" }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--primary), var(--info))",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.68rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials(staffName ?? "")}
        </div>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {staffName}
        </div>
        <button
          onClick={() => router.push("/dashboard/chat")}
          title="Open full inbox"
          style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "flex" }}
        >
          <ExternalLink size={14} />
        </button>
        <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "flex" }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {messages.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem", margin: "auto" }}>No messages yet.</p>
        ) : (
          messages.map((m) => {
            const mine = m.SenderType === "admin";
            return (
              <div key={m.Id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                <div
                  style={{
                    background: mine ? "linear-gradient(135deg, var(--primary), var(--info))" : "var(--surface-2)",
                    color: mine ? "#fff" : "var(--ink)",
                    borderRadius: 10,
                    borderBottomRightRadius: mine ? 3 : 10,
                    borderBottomLeftRadius: mine ? 10 : 3,
                    padding: "0.4rem 0.6rem",
                    fontSize: "0.8rem",
                    wordBreak: "break-word",
                  }}
                >
                  {m.Message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: "flex", gap: "0.4rem", padding: "0.6rem", borderTop: "1px solid var(--border)" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Reply..."
          style={{ flex: 1, padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.8rem" }}
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          aria-label="Send"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            flexShrink: 0,
            background: draft.trim() ? "linear-gradient(135deg, var(--primary), var(--info))" : "var(--surface-2)",
            color: draft.trim() ? "#fff" : "var(--ink-muted)",
            cursor: sending || !draft.trim() ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
