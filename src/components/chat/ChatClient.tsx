"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Search, Send, Trash2, Bell, Headset, X } from "lucide-react";

export interface StaffChatSummary {
  Id: number;
  Name: string;
  LastMessage: string | null;
  LastSenderType: string | null;
  LastMessageAt: string | null;
  UnreadCount: number;
}

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

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function isGroupStart(messages: ChatMessage[], i: number): boolean {
  return i === 0 || messages[i - 1].SenderType !== messages[i].SenderType;
}

function isNewDay(messages: ChatMessage[], i: number): boolean {
  return i === 0 || new Date(messages[i - 1].CreatedAt).toDateString() !== new Date(messages[i].CreatedAt).toDateString();
}

export default function ChatClient({ initialStaff, allStaff }: { initialStaff: StaffChatSummary[]; allStaff: { Id: number; Name: string }[] }) {
  const toast = useToast();
  const [staffList, setStaffList] = useState(initialStaff);
  const [selectedId, setSelectedId] = useState<number | null>(initialStaff[0]?.Id ?? null);
  const [selectedName, setSelectedName] = useState<string | null>(initialStaff[0]?.Name ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newChatStaffId, setNewChatStaffId] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyDraft, setNotifyDraft] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function loadThread(staffId: number, name: string) {
    setSelectedId(staffId);
    setSelectedName(name);
    setLoading(true);
    setError(null);
    setConfirmingDelete(false);
    setNotifyOpen(false);
    try {
      const res = await fetch(`/api/admin/chat/${staffId}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load conversation.");
        setMessages([]);
      } else {
        setMessages(data.messages);
        setStaffList((prev) => prev.map((s) => (s.Id === staffId ? { ...s, UnreadCount: 0 } : s)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/chat/${selectedId}`);
        const data = await res.json();
        if (res.ok && data.ok) setMessages(data.messages);
      } catch {
        // transient poll failure — try again next tick
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [draft]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !selectedId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/chat/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to send message.");
      } else {
        setDraft("");
        await loadThread(selectedId, selectedName ?? "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation() {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/chat/${selectedId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "Failed to delete conversation." });
        return;
      }
      setStaffList((prev) => prev.filter((s) => s.Id !== selectedId));
      setMessages([]);
      setSelectedId(null);
      setSelectedName(null);
      toast.show({ type: "success", message: "Conversation deleted." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete conversation." });
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function sendNotification() {
    const text = notifyDraft.trim();
    if (!text || !selectedId) return;
    setNotifySending(true);
    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: selectedId, message: text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "Failed to send notification." });
        return;
      }
      toast.show({ type: "success", message: `Notification popped up for ${selectedName}.` });
      setNotifyDraft("");
      setNotifyOpen(false);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to send notification." });
    } finally {
      setNotifySending(false);
    }
  }

  function startNewChat() {
    const id = Number(newChatStaffId);
    const staff = allStaff.find((s) => s.Id === id);
    if (!staff) return;
    if (!staffList.some((s) => s.Id === id)) {
      setStaffList((prev) => [{ Id: staff.Id, Name: staff.Name, LastMessage: null, LastSenderType: null, LastMessageAt: null, UnreadCount: 0 }, ...prev]);
    }
    loadThread(staff.Id, staff.Name);
    setNewChatStaffId("");
  }

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter((s) => s.Name.toLowerCase().includes(q));
  }, [staffList, search]);

  const totalUnread = useMemo(() => staffList.reduce((sum, s) => sum + s.UnreadCount, 0), [staffList]);

  return (
    <div className="dash-panel" style={{ display: "flex", gap: 0, padding: 0, minHeight: 560, overflow: "hidden" }}>
      {/* Staff list */}
      <div style={{ width: 280, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "0.75rem", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)" }}>Conversations</span>
            {totalUnread > 0 && <Badge tone="danger">{totalUnread} unread</Badge>}
          </div>
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              style={{
                width: "100%",
                padding: "0.45rem 0.6rem 0.45rem 1.7rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--ink)",
                fontSize: "0.8rem",
              }}
            />
          </div>
          <select
            value={newChatStaffId}
            onChange={(e) => {
              setNewChatStaffId(e.target.value);
              if (e.target.value) startNewChat();
            }}
            style={{ width: "100%", padding: "0.5rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.82rem" }}
          >
            <option value="">+ Start a new chat...</option>
            {allStaff.map((s) => (
              <option key={s.Id} value={s.Id}>
                {s.Name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredStaff.length === 0 ? (
            <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>
              {staffList.length === 0 ? "No conversations yet." : "No matches."}
            </p>
          ) : (
            filteredStaff.map((s) => (
              <button
                key={s.Id}
                onClick={() => loadThread(s.Id, s.Name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.6rem 0.85rem",
                  background: selectedId === s.Id ? "var(--surface-2)" : "transparent",
                  border: "none",
                  borderLeft: selectedId === s.Id ? "3px solid var(--primary)" : "3px solid transparent",
                  borderBottom: "1px solid var(--grid)",
                  cursor: "pointer",
                  transition: "background 0.12s ease",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "linear-gradient(135deg, var(--primary), var(--info))",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {initials(s.Name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem" }}>
                    <strong style={{ fontSize: "0.84rem", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.Name}
                    </strong>
                    {s.LastMessageAt && (
                      <span style={{ fontSize: "0.68rem", color: "var(--ink-muted)", flexShrink: 0 }}>{relativeTime(s.LastMessageAt)}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem" }}>
                    {s.LastMessage ? (
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                        {s.LastSenderType === "admin" ? "You: " : ""}
                        {s.LastMessage}
                      </div>
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)", fontStyle: "italic" }}>No messages yet</span>
                    )}
                    {s.UnreadCount > 0 && <Badge tone="danger">{s.UnreadCount}</Badge>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!selectedId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--ink-muted)" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Headset size={22} style={{ color: "var(--primary)" }} />
            </div>
            <p style={{ fontSize: "0.88rem", margin: 0 }}>Select or start a conversation.</p>
          </div>
        ) : (
          <>
            <div
              style={{
                padding: "0.7rem 1rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--primary), var(--info))",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {initials(selectedName ?? "")}
              </div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", flex: 1, minWidth: 0 }}>{selectedName}</div>

              <button
                onClick={() => setNotifyOpen((o) => !o)}
                title="Send a one-off popup notification"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: notifyOpen ? "var(--surface-2)" : "transparent",
                  color: "var(--ink-secondary)",
                  cursor: "pointer",
                }}
              >
                <Bell size={14} />
              </button>
              {confirmingDelete ? (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Delete all messages?</span>
                  <button
                    onClick={deleteConversation}
                    disabled={deleting}
                    style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", borderRadius: 6, border: "none", background: "var(--danger)", color: "#fff", cursor: "pointer" }}
                  >
                    {deleting ? "..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer" }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  title="Delete conversation"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--ink-muted)",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {notifyOpen && (
              <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", gap: "0.5rem" }}>
                <input
                  value={notifyDraft}
                  onChange={(e) => setNotifyDraft(e.target.value.slice(0, 500))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendNotification();
                  }}
                  placeholder="Pop up a quick notification on their screen..."
                  style={{ flex: 1, padding: "0.5rem 0.7rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.82rem" }}
                />
                <button
                  onClick={sendNotification}
                  disabled={notifySending || !notifyDraft.trim()}
                  style={{ padding: "0.5rem 0.9rem", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {notifySending ? "Sending..." : "Notify"}
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", opacity: 0.5 }}>
                  {[55, 38, 65].map((w, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: i % 2 ? "flex-end" : "flex-start",
                        width: `${w}%`,
                        height: 32,
                        borderRadius: 12,
                        background: "var(--surface-2)",
                        animation: "adminChatShimmer 1.4s ease-in-out infinite",
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: "auto" }}>No messages yet — say hello.</p>
              ) : (
                messages.map((m, i) => {
                  const mine = m.SenderType === "admin";
                  const groupStart = isGroupStart(messages, i);
                  return (
                    <div key={m.Id}>
                      {isNewDay(messages, i) && (
                        <div style={{ textAlign: "center", margin: "0.9rem 0 0.6rem", fontSize: "0.7rem", color: "var(--ink-muted)" }}>{dayLabel(m.CreatedAt)}</div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-end",
                          gap: "0.5rem",
                          flexDirection: mine ? "row-reverse" : "row",
                          marginTop: groupStart ? "0.6rem" : "0.15rem",
                          animation: "adminChatMessageIn 0.2s ease-out",
                        }}
                      >
                        <div style={{ width: 24, flexShrink: 0 }}>
                          {groupStart && (
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                background: mine ? "var(--primary)" : "var(--surface-2)",
                                color: mine ? "#fff" : "var(--ink-secondary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.6rem",
                                fontWeight: 700,
                              }}
                            >
                              {initials(m.SenderName)}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            maxWidth: "70%",
                            background: mine ? "linear-gradient(135deg, var(--primary), var(--info))" : "var(--surface-2)",
                            color: mine ? "#fff" : "var(--ink)",
                            borderRadius: 12,
                            borderBottomRightRadius: mine ? 4 : 12,
                            borderBottomLeftRadius: mine ? 12 : 4,
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.85rem",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                            wordBreak: "break-word",
                          }}
                        >
                          <div>{m.Message}</div>
                          <div style={{ fontSize: "0.66rem", opacity: 0.75, marginTop: "0.2rem", textAlign: mine ? "right" : "left" }}>
                            {new Date(m.CreatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            {error && <div className="error" style={{ margin: "0 1rem" }}>{error}</div>}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", padding: "0.75rem 1rem", borderTop: "1px solid var(--border)" }}>
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
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  resize: "none",
                  padding: "0.55rem 0.75rem",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--ink)",
                  fontSize: "0.85rem",
                  fontFamily: "inherit",
                  maxHeight: 120,
                  outline: "none",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !draft.trim()}
                aria-label="Send"
                style={{
                  width: 38,
                  height: 38,
                  flexShrink: 0,
                  borderRadius: "50%",
                  border: "none",
                  background: draft.trim() ? "linear-gradient(135deg, var(--primary), var(--info))" : "var(--surface-2)",
                  color: draft.trim() ? "#fff" : "var(--ink-muted)",
                  cursor: sending || !draft.trim() ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send size={15} style={{ marginLeft: -1 }} />
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes adminChatMessageIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes adminChatShimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
