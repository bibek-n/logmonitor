import type { Metadata } from "next";
import { MKT } from "@/lib/marketingTheme";
import { ABOUT_SOFTWARE_FEATURES } from "@/lib/websiteContent";

export const metadata: Metadata = {
  title: "About the Software — Log Monitor",
  description: "A complete IT management platform: security monitoring, network management, hardware asset tracking, staff monitoring, alerts, reporting, and ticketing.",
};

export default function AboutSoftwarePage() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>About the Software</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 720 }}>
        Log Monitor brings together everything an IT team needs to keep infrastructure secure, visible, and
        well-managed — real-time monitoring, hardware inventory, staff activity oversight, and a built-in support
        ticket system, all from one dashboard.
      </p>

      <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {ABOUT_SOFTWARE_FEATURES.map((f) => (
          <div key={f.title} style={{ border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.25rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.5rem" }}>{f.title}</h2>
            <p style={{ fontSize: "0.9rem", color: MKT.inkMuted, margin: 0, lineHeight: 1.6 }}>{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
