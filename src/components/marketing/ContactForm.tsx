"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { MKT } from "@/lib/marketingTheme";

// White background + dark text, matching the login page's own form fields (white fields read
// on a purple card) - MKT.ink is white now (for text sitting directly on the page/card
// background), which would be invisible against a plain white input left unset.
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.8rem",
  borderRadius: 8,
  border: `1px solid ${MKT.border}`,
  background: "#fff",
  fontSize: "0.9rem",
  color: "#1E1B2E",
};

export function ContactForm() {
  const t = useTranslations("contact.form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || null, subject: subject || null, message }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setName("");
      setEmail("");
      setPhone("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div style={{ background: "rgba(34, 197, 94, 0.14)", border: "1px solid rgba(34, 197, 94, 0.4)", borderRadius: 10, padding: "1.25rem", color: "#4ADE80" }}>
        {t("success")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input style={inputStyle} placeholder={t("namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} required />
      <input style={inputStyle} type="email" placeholder={t("emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input style={inputStyle} placeholder={t("phonePlaceholder")} value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input style={inputStyle} placeholder={t("subjectPlaceholder")} value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea
        style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
        placeholder={t("messagePlaceholder")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      {status === "error" && <div style={{ color: "#F87171", fontSize: "0.85rem" }}>{t("error")}</div>}
      <button
        type="submit"
        disabled={status === "submitting"}
        style={{ background: MKT.primary, color: "#fff", padding: "0.7rem", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}
      >
        {status === "submitting" ? t("sending") : t("sendButton")}
      </button>
    </form>
  );
}
