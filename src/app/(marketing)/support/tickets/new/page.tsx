import type { Metadata } from "next";
import { MKT } from "@/lib/marketingTheme";
import { TicketForm } from "@/components/marketing/TicketForm";

export const metadata: Metadata = {
  title: "Submit a Support Ticket — Log Monitor",
  description: "Submit a support ticket and our team will get back to you.",
};

export default function NewTicketPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.5rem" }}>Submit a Support Ticket</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "0.95rem", marginBottom: "2rem" }}>
        Tell us what&apos;s going on and we&apos;ll follow up as soon as possible.
      </p>
      <div style={{ background: "#fff", border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
        <TicketForm />
      </div>
    </div>
  );
}
