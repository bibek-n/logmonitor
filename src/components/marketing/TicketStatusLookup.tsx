"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { MKT } from "@/lib/marketingTheme";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.8rem",
  borderRadius: 8,
  border: `1px solid ${MKT.border}`,
  fontSize: "0.9rem",
  color: MKT.ink,
};

interface TicketStatusResult {
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  replies: { message: string; createdAt: string }[];
}

export function TicketStatusLookup() {
  const t = useTranslations("ticketStatus");
  const [ticketNumber, setTicketNumber] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<TicketStatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/public/tickets/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketNumber, email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? t("notFoundError"));
        return;
      }
      setResult(data.ticket);
    } catch {
      setError(t("genericError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          style={inputStyle}
          placeholder={t("ticketNumberPlaceholder")}
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          required
        />
        <input style={inputStyle} type="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required />
        {error && <div style={{ color: "#DC2626", fontSize: "0.85rem" }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{ background: MKT.primary, color: "#fff", padding: "0.7rem", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}
        >
          {loading ? t("checking") : t("checkButton")}
        </button>
      </form>

      {result && (
        <div style={{ border: `1px solid ${MKT.border}`, borderRadius: 10, padding: "1.25rem" }}>
          <div className="flex items-center justify-between mb-2">
            <strong style={{ color: MKT.ink }}>{result.ticketNumber}</strong>
            <span style={{ background: MKT.surfaceAlt, color: MKT.ink, padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.78rem", fontWeight: 600 }}>
              {t.has(`statusLabels.${result.status}`) ? t(`statusLabels.${result.status}`) : result.status}
            </span>
          </div>
          <p style={{ fontSize: "0.9rem", color: MKT.ink, margin: "0 0 0.4rem" }}>{result.subject}</p>
          <p style={{ fontSize: "0.8rem", color: MKT.inkMuted, margin: 0 }}>
            {result.category} &middot; {result.priority} {t("priorityLabel")} &middot; {t("submittedLabel")}{" "}
            {new Date(result.createdAt).toLocaleString()}
          </p>

          {result.replies.length > 0 && (
            <div className="flex flex-col gap-2" style={{ marginTop: "1rem" }}>
              {result.replies.map((r, i) => (
                <div key={i} style={{ background: MKT.surface, borderRadius: 8, padding: "0.75rem", fontSize: "0.85rem" }}>
                  <div style={{ color: MKT.ink, marginBottom: "0.25rem" }}>{r.message}</div>
                  <div style={{ color: MKT.inkMuted, fontSize: "0.75rem" }}>{new Date(r.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
