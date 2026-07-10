"use client";

import { useState, FormEvent } from "react";
import { MKT } from "@/lib/marketingTheme";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.8rem",
  borderRadius: 8,
  border: `1px solid ${MKT.border}`,
  fontSize: "0.9rem",
  color: MKT.ink,
};

export function ContactForm() {
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
      <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "1.25rem", color: "#065F46" }}>
        Thanks — your message has been sent. We&apos;ll get back to you soon.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input style={inputStyle} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
      <input style={inputStyle} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input style={inputStyle} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input style={inputStyle} placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea
        style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
        placeholder="How can we help?"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
      />
      {status === "error" && <div style={{ color: "#DC2626", fontSize: "0.85rem" }}>Something went wrong — please try again.</div>}
      <button
        type="submit"
        disabled={status === "submitting"}
        style={{ background: MKT.primary, color: "#fff", padding: "0.7rem", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}
      >
        {status === "submitting" ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
