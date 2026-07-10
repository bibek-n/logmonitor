"use client";

import { useState, FormEvent } from "react";
import { MKT } from "@/lib/marketingTheme";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/websiteContent";

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

export function TicketForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState(TICKET_PRIORITIES[1]);
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setError("Attachment must be 10 MB or smaller.");
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
    formData.append("category", category);
    formData.append("priority", priority);
    formData.append("description", description);
    if (attachment) formData.append("attachment", attachment);

    try {
      const res = await fetch("/api/public/tickets", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong — please try again.");
        setStatus("error");
        return;
      }
      setTicketNumber(data.ticketNumber);
    } catch {
      setError("Something went wrong — please try again.");
      setStatus("error");
    }
  }

  if (ticketNumber) {
    return (
      <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "1.5rem", color: "#065F46" }}>
        <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Ticket submitted successfully.</p>
        <p style={{ margin: 0 }}>
          Your ticket number is <strong>{ticketNumber}</strong>. Save this — you&apos;ll need it (along with your
          email) to check the status later.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <input style={inputStyle} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input style={inputStyle} type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <input style={inputStyle} placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <select style={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)}>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select style={inputStyle} value={priority} onChange={(e) => setPriority(e.target.value)}>
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <textarea
        style={{ ...inputStyle, minHeight: 140, resize: "vertical" }}
        placeholder="Describe the issue in detail"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <div className="flex flex-col gap-1">
        <label style={{ fontSize: "0.82rem", color: MKT.inkMuted }}>Attachment (optional, max 10 MB)</label>
        <input type="file" onChange={handleFileChange} style={{ fontSize: "0.85rem" }} />
      </div>
      {error && <div style={{ color: "#DC2626", fontSize: "0.85rem" }}>{error}</div>}
      <button
        type="submit"
        disabled={status === "submitting"}
        style={{ background: MKT.primary, color: "#fff", padding: "0.75rem", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}
      >
        {status === "submitting" ? "Submitting..." : "Submit Ticket"}
      </button>
    </form>
  );
}
