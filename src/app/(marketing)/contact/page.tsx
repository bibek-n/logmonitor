import type { Metadata } from "next";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import { CONTACT_INFO } from "@/lib/websiteContent";
import { ContactForm } from "@/components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us — Log Monitor",
  description: "Get in touch with the Log Monitor team.",
};

export default function ContactPage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>Contact Us</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 720 }}>
        Have a question or need help? Reach out and our team will respond as soon as possible.
      </p>

      <div className="grid gap-8" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)" }}>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <MapPin size={20} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: MKT.ink, fontSize: "0.92rem" }}>Address</div>
              <div style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>{CONTACT_INFO.address}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone size={20} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: MKT.ink, fontSize: "0.92rem" }}>Phone</div>
              <div style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>{CONTACT_INFO.phone}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail size={20} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: MKT.ink, fontSize: "0.92rem" }}>Email</div>
              <div style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>{CONTACT_INFO.email}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={20} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: MKT.ink, fontSize: "0.92rem" }}>Business Hours</div>
              <div style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>{CONTACT_INFO.hours}</div>
            </div>
          </div>

          <div
            style={{
              background: MKT.surface,
              border: `1px dashed ${MKT.border}`,
              borderRadius: 10,
              padding: "1.25rem",
              color: MKT.inkMuted,
              fontSize: "0.85rem",
              textAlign: "center",
            }}
          >
            Map will appear here once a company address is configured.
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
