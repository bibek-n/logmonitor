import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import { ABOUT_US } from "@/lib/websiteContent";

export const metadata: Metadata = {
  title: "About Us — Log Monitor",
  description: "Our company, vision, and mission behind the Log Monitor IT management platform.",
};

export default function AboutUsPage() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "1.5rem" }}>About Our Company</h1>

      <p style={{ color: MKT.ink, fontSize: "1.02rem", lineHeight: 1.75, marginBottom: "1.1rem" }}>{ABOUT_US.intro}</p>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.75, marginBottom: "1.1rem" }}>{ABOUT_US.combined}</p>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.75, marginBottom: "2.5rem" }}>{ABOUT_US.missionStatement}</p>

      <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div style={{ background: MKT.surface, border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.75rem" }}>Our Vision</h2>
          <p style={{ fontSize: "0.92rem", color: MKT.inkMuted, lineHeight: 1.65, margin: 0 }}>{ABOUT_US.vision}</p>
        </div>

        <div style={{ background: MKT.surface, border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.75rem" }}>Our Mission</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {ABOUT_US.missionPoints.map((point) => (
              <li key={point} className="flex items-start gap-2" style={{ fontSize: "0.92rem", color: MKT.inkMuted }}>
                <CheckCircle2 size={16} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
