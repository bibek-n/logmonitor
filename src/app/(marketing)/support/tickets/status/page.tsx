import type { Metadata } from "next";
import { MKT } from "@/lib/marketingTheme";
import { TicketStatusLookup } from "@/components/marketing/TicketStatusLookup";

export const metadata: Metadata = {
  title: "Check Ticket Status — Log Monitor",
  description: "Check the status of a support ticket you submitted.",
};

export default function TicketStatusPage() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.5rem" }}>Check Ticket Status</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "0.95rem", marginBottom: "2rem" }}>
        Enter your ticket number and the email you used to submit it.
      </p>
      <TicketStatusLookup />
    </div>
  );
}
