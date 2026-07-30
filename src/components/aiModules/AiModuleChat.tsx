"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { Send, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  toolsUsed?: string[];
}

interface AiModuleChatProps {
  apiEndpoint: string;
  exampleQuestions: string[];
  icon: ReactNode;
  placeholder?: string;
}

// Generic version of AiAssistantChat.tsx's chat UI, parameterized by API endpoint/example
// questions/icon so the 6 AI Modules (Root Cause Analysis, Alert Correlation, AI Incident
// Summary, AI Log Analyzer, AI Configuration Review, AI Threat Detection) share one component
// instead of duplicating the same chat layout 6 times - they're the same interaction pattern
// (ask a focused question, get a tool-grounded answer) aimed at different data/prompts.
function AiModuleChatInner({ apiEndpoint, exampleQuestions, icon, placeholder }: AiModuleChatProps) {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Something went wrong.");
      setMessages((m) => [...m, { role: "assistant", text: data.answer, toolsUsed: data.toolsUsed }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.show({ type: "error", message });
      setMessages((m) => [...m, { role: "assistant", text: `I couldn't answer that: ${message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ padding: 0, display: "flex", flexDirection: "column", height: "70vh" }}>
      <div ref={scrollRef} className="flex flex-col gap-3" style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {messages.length === 0 && (
          <div>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", marginBottom: "0.6rem" }}>Try asking:</p>
            <div className="flex flex-col gap-2" style={{ maxWidth: 460 }}>
              {exampleQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  style={{
                    textAlign: "left",
                    padding: "0.55rem 0.8rem",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                    fontSize: "0.82rem",
                    cursor: "pointer",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className="flex items-start gap-2" style={{ flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <div
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: m.role === "user" ? "var(--surface-2)" : "var(--primary)",
                color: m.role === "user" ? "var(--ink-muted)" : "#fff",
              }}
            >
              {m.role === "user" ? <User size={14} /> : icon}
            </div>
            <div
              style={{
                maxWidth: "75%",
                padding: "0.6rem 0.85rem",
                borderRadius: 10,
                background: m.role === "user" ? "var(--primary)" : "var(--surface-2)",
                color: m.role === "user" ? "#fff" : "var(--ink)",
                fontSize: "0.85rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
              {m.toolsUsed && m.toolsUsed.length > 0 && (
                <div style={{ marginTop: "0.4rem", fontSize: "0.7rem", color: "var(--ink-muted)" }}>
                  Data used: {m.toolsUsed.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>Analyzing...</p>}
      </div>

      <div className="flex items-center gap-2" style={{ padding: "0.75rem 1rem", borderTop: "1px solid var(--border)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          placeholder={placeholder ?? "Ask a question..."}
          disabled={loading}
          style={{
            flex: 1,
            padding: "0.55rem 0.8rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: "0.85rem",
          }}
        />
        <Button size="sm" onClick={() => ask(input)} disabled={loading || !input.trim()}>
          <Send size={13} /> Ask
        </Button>
      </div>
    </Card>
  );
}

export function AiModuleChat(props: AiModuleChatProps) {
  return (
    <ToastProvider>
      <AiModuleChatInner {...props} />
    </ToastProvider>
  );
}
