import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getDb } from "@/lib/db";
import { Hero } from "@/components/marketing/Hero";
import { ServiceCard } from "@/components/marketing/ServiceCard";
import { WhyChooseUsCard } from "@/components/marketing/WhyChooseUsCard";
import { SERVICES, WHY_CHOOSE_US, ABOUT_SOFTWARE_FEATURES } from "@/lib/websiteContent";
import { MKT } from "@/lib/marketingTheme";
import type { SlideData } from "@/components/marketing/Slider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Log Monitor — Security, Network & Staff Monitoring Solution",
  description:
    "A complete IT management platform combining security monitoring, network management, hardware asset tracking, staff monitoring, and support ticketing in one dashboard.",
};

interface SlideRow {
  Id: number;
  Title: string | null;
  Subtitle: string | null;
  ButtonText: string | null;
  ButtonUrl: string | null;
  ImagePath: string;
}

export default async function HomePage() {
  const db = await getDb();
  const result = await db.query<SlideRow>(`
    SELECT Id, Title, Subtitle, ButtonText, ButtonUrl, ImagePath
    FROM SliderImages
    WHERE Enabled = 1
      AND (PublishStartAt IS NULL OR PublishStartAt <= SYSUTCDATETIME())
      AND (PublishEndAt IS NULL OR PublishEndAt >= SYSUTCDATETIME())
    ORDER BY SortOrder ASC
  `);
  const slides: SlideData[] = result.recordset.map((r) => ({
    id: r.Id,
    title: r.Title,
    subtitle: r.Subtitle,
    buttonText: r.ButtonText,
    buttonUrl: r.ButtonUrl,
    imagePath: r.ImagePath,
  }));

  return (
    <div>
      <Hero slides={slides} />

      <section style={{ padding: "3.5rem 1.25rem", maxWidth: 1200, margin: "0 auto" }}>
        <div className="text-center" style={{ maxWidth: 700, margin: "0 auto 2rem" }}>
          <h2 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>About the Software</h2>
          <p style={{ color: MKT.inkMuted, fontSize: "0.98rem", lineHeight: 1.6 }}>
            A centralized platform covering everything IT teams need to keep infrastructure secure, visible, and
            well-managed.
          </p>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {ABOUT_SOFTWARE_FEATURES.slice(0, 6).map((f) => (
            <div key={f.title} style={{ padding: "1rem 0" }}>
              <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.35rem" }}>{f.title}</h3>
              <p style={{ fontSize: "0.85rem", color: MKT.inkMuted, margin: 0, lineHeight: 1.55 }}>{f.description}</p>
            </div>
          ))}
        </div>
        <div className="text-center" style={{ marginTop: "1.5rem" }}>
          <Link href="/about-software" style={{ color: MKT.primary, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            See everything the software does <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <section style={{ background: MKT.surface, padding: "3.5rem 1.25rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="text-center" style={{ maxWidth: 700, margin: "0 auto 2rem" }}>
            <h2 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>Our Services</h2>
          </div>
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {SERVICES.map((s) => (
              <ServiceCard key={s.title} service={s} />
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "3.5rem 1.25rem", maxWidth: 1200, margin: "0 auto" }}>
        <div className="text-center" style={{ maxWidth: 700, margin: "0 auto 2rem" }}>
          <h2 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>Why Choose Us</h2>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {WHY_CHOOSE_US.map((item) => (
            <WhyChooseUsCard key={item.title} item={item} />
          ))}
        </div>
      </section>

      <section style={{ background: MKT.ink, padding: "3rem 1.25rem", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>
          Ready to secure and simplify your IT infrastructure?
        </h2>
        <p style={{ color: "#94A3B8", marginBottom: "1.5rem" }}>Sign in to your dashboard or get in touch with our team.</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/login" style={{ background: MKT.primary, color: "#fff", padding: "0.7rem 1.4rem", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            Login
          </Link>
          <Link href="/contact" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", padding: "0.7rem 1.4rem", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}
