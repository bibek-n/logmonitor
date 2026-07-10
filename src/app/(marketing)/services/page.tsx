import type { Metadata } from "next";
import { MKT } from "@/lib/marketingTheme";
import { SERVICES } from "@/lib/websiteContent";
import { ServiceCard } from "@/components/marketing/ServiceCard";

export const metadata: Metadata = {
  title: "Our Services — Log Monitor",
  description: "Security management, network monitoring, hardware management, staff monitoring, and support services.",
};

export default function ServicesPage() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>Our Services</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 720 }}>
        Everything you need to keep your organization&apos;s technology secure, connected, and running smoothly.
      </p>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {SERVICES.map((s) => (
          <ServiceCard key={s.title} service={s} />
        ))}
      </div>
    </div>
  );
}
