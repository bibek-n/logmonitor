"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { MKT } from "@/lib/marketingTheme";
import { TICKET_CATEGORY_KEYS, TICKET_PRIORITY_KEYS } from "@/lib/websiteContent";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.8rem",
  borderRadius: 8,
  border: `1px solid ${MKT.border}`,
  fontSize: "0.9rem",
  color: MKT.ink,
  background: "#fff",
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// The admin dashboard's ticket list stores/filters on these exact English labels
// regardless of which language the public submitter's browser is set to — only the
// dropdown's displayed text is translated, never the value actually submitted.
const CATEGORY_EN_LABELS: Record<(typeof TICKET_CATEGORY_KEYS)[number], string> = {
  general: "General Inquiry",
  technical: "Technical Issue",
  billing: "Billing",
  feature: "Feature Request",
  bug: "Bug Report",
  other: "Other",
};
const PRIORITY_EN_LABELS: Record<(typeof TICKET_PRIORITY_KEYS)[number], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function TicketForm() {
  const t = useTranslations("newTicket");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof TICKET_CATEGORY_KEYS)[number]>(TICKET_CATEGORY_KEYS[0]);
  const [priority, setPriority] = useState<(typeof TICKET_PRIORITY_KEYS)[number]>(TICKET_PRIORITY_KEYS[1]);
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setError(t("attachmentTooLarge"));
      setAttachment(null);
      e.target.value = "";
      return;
    }
    setError(null);
    setAttachment(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("subject", subject);
    formData.append("category", CATEGORY_EN_LABELS[category]);
    formData.append("priority", PRIORITY_EN_LABELS[priority]);
    formData.append("description", description);
    if (attachment) formData.append("attachment", attachment);

    try {
      const res = await fetch("/api/public/tickets", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? t("genericError"));
        setStatus("error");
        return;
      }
      setTicketNumber(data.ticketNumber);
    } catch {
      setError(t("genericError"));
      setStatus("error");
    }
  }

  if (ticketNumber) {
    return (
      <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "1.5rem", color: "#065F46" }}>
        <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>{t("successTitle")}</p>
        <p style={{ margin: 0 }}>{t("successBody", { ticketNumber })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <input style={inputStyle} placeholder={t("namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required />
        <input style={inputStyle} type="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <input style={inputStyle} placeholder={t("subjectPlaceholder")} value={subject} onChange={(e) => setSubject(e.target.value)} required />
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value as (typeof TICKET_CATEGORY_KEYS)[number])}>
          {TICKET_CATEGORY_KEYS.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
        <select style={inputStyle} value={priority} onChange={(e) => setPriority(e.target.value as (typeof TICKET_PRIORITY_KEYS)[number])}>
          {TICKET_PRIORITY_KEYS.map((p) => (
            <option key={p} value={p}>
              {t(`priorities.${p}`)}
            </option>
          ))}
        </select>
      </div>
      <textarea
        style={{ ...inputStyle, minHeight: 140, resize: "vertical" }}
        placeholder={t("descriptionPlaceholder")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <div className="flex flex-col gap-1">
        <label style={{ fontSize: "0.82rem", color: MKT.inkMuted }}>{t("attachmentLabel")}</label>
        <input type="file" onChange={handleFileChange} style={{ fontSize: "0.85rem" }} />
      </div>
      {error && <div style={{ color: "#DC2626", fontSize: "0.85rem" }}>{error}</div>}
      <button
        type="submit"
        disabled={status === "submitting"}
        style={{ background: MKT.primary, color: "#fff", padding: "0.75rem", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}
      >
        {status === "submitting" ? t("submitting") : t("submitButton")}
      </button>
    </form>
  );
}
