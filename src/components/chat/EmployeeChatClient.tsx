"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Headset } from "lucide-react";

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Groups consecutive messages from the same sender so only the first in a run gets an
// avatar + full spacing - matches how every mainstream chat app avoids repeating the same
// avatar down a whole column of back-to-back messages from one person.
function isGroupStart(messages: ChatMessage[], i: number): boolean {
  return i === 0 || messages[i - 1].SenderType !== messages[i].SenderType;
}

export default function EmployeeChatClient({ deviceId, token, staffName }: { deviceId: string; token: string; staffName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageIdRef = useRef<number | null>(null);

  const endpoint = `/api/chat/${deviceId}?token=${encodeURIComponent(token)}`;

  async function load() {
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (res.ok && data.ok) setMessages(data.messages);
    } catch {
      // transient poll failure — try again next tick
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every poll tick calls setMessages with a freshly-parsed array, even when nothing
  // actually changed - scrolling on every [messages] change (the old behavior) yanked the
  // view back to the bottom every 5 seconds, fighting anyone trying to scroll up and read
  // history. Only auto-scroll when the last message's own id is new, and only if the
  // reader was already near the bottom (so it doesn't interrupt reading old messages, but
  // still tracks a live conversation).
  useEffect(() => {
    const latest = messages[messages.length - 1];
    const isNewMessage = latest && latest.Id !== lastMessageIdRef.current;
    if (latest) lastMessageIdRef.current = latest.Id;
    if (!isNewMessage) return;

    const container = scrollContainerRef.current;
    const nearBottom = !container || container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [draft]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to send message.");
      } else {
        setDraft("");
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxWidth: 560,
        margin: "0 auto",
        background: "var(--bg)",
        color: "var(--ink)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.9rem 1.1rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), var(--info))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Headset size={18} />
          </div>
          <span
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--success)",
              border: "2px solid var(--surface)",
              animation: "chatPulse 2s ease-in-out infinite",
            }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", lineHeight: 1.2 }}>IT Support</div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Chatting as {staffName}</div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", opacity: 0.5 }}>
            {[62, 40, 70].map((w, i) => (
              <div
                key={i}
                style={{
                  alignSelf: i % 2 ? "flex-end" : "flex-start",
                  width: `${w}%`,
                  height: 36,
                  borderRadius: 14,
                  background: "var(--surface-2)",
                  animation: "chatShimmer 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.6rem",
              color: "var(--ink-muted)",
              textAlign: "center",
              padding: "0 1.5rem",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--surface-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Headset size={22} style={{ color: "var(--primary)" }} />
            </div>
            <p style={{ fontSize: "0.88rem", margin: 0 }}>No messages yet.</p>
            <p style={{ fontSize: "0.82rem", margin: 0 }}>Describe your problem below and IT will respond here.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.SenderType === "employee";
            const groupStart = isGroupStart(messages, i);
            return (
              <div
                key={m.Id}
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "0.5rem",
                  flexDirection: mine ? "row-reverse" : "row",
                  marginTop: groupStart ? "0.7rem" : "0.15rem",
                  animation: "chatMessageIn 0.25s ease-out",
                }}
              >
                <div style={{ width: 26, flexShrink: 0 }}>
                  {groupStart && (
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: mine ? "var(--primary)" : "var(--surface-2)",
                        color: mine ? "#fff" : "var(--ink-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                      }}
                    >
                      {mine ? initials(m.SenderName) : <Headset size={12} />}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    maxWidth: "72%",
                    background: mine ? "linear-gradient(135deg, var(--primary), var(--info))" : "var(--surface-2)",
                    color: mine ? "#fff" : "var(--ink)",
                    borderRadius: 14,
                    borderBottomRightRadius: mine ? 4 : 14,
                    borderBottomLeftRadius: mine ? 14 : 4,
                    padding: "0.55rem 0.8rem",
                    fontSize: "0.88rem",
                    lineHeight: 1.4,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                    wordBreak: "break-word",
                  }}
                >
                  <div>{m.Message}</div>
                  <div
                    style={{
                      fontSize: "0.66rem",
                      opacity: 0.7,
                      marginTop: "0.3rem",
                      textAlign: mine ? "right" : "left",
                    }}
                  >
                    {formatTime(m.CreatedAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div
          style={{
            color: "var(--danger)",
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            margin: "0 1.1rem 0.5rem",
            padding: "0.5rem 0.7rem",
            borderRadius: 8,
            fontSize: "0.8rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Composer */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "0.6rem",
          padding: "0.85rem 1.1rem",
          borderTop: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Describe your problem..."
          style={{
            flex: 1,
            resize: "none",
            padding: "0.6rem 0.85rem",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--ink)",
            fontSize: "0.88rem",
            fontFamily: "inherit",
            maxHeight: 120,
            lineHeight: 1.4,
            outline: "none",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !draft.trim()}
          aria-label="Send"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: "50%",
            border: "none",
            background: draft.trim() ? "linear-gradient(135deg, var(--primary), var(--info))" : "var(--surface-2)",
            color: draft.trim() ? "#fff" : "var(--ink-muted)",
            cursor: sending || !draft.trim() ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.12s ease, opacity 0.12s ease",
            opacity: sending ? 0.6 : 1,
          }}
          onMouseDown={(e) => {
            if (!sending && draft.trim()) e.currentTarget.style.transform = "scale(0.92)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <Send size={16} style={{ marginLeft: -1 }} />
        </button>
      </div>

      <style>{`
        @keyframes chatMessageIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 55%, transparent); }
          50% { box-shadow: 0 0 0 4px transparent; }
        }
        @keyframes chatShimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        textarea::placeholder { color: var(--ink-muted); }
        textarea:focus { border-color: var(--primary) !important; }
      `}</style>
    </div>
  );
}
