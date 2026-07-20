import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db";
import { Hero } from "@/components/marketing/Hero";
import { DevAiNewsWidget } from "@/components/marketing/DevAiNewsWidget";
import { KnowledgeHub } from "@/components/marketing/KnowledgeHub";
import { AiVideoPicksWidget } from "@/components/marketing/AiVideoPicksWidget";
import { DemoVideoSection } from "@/components/marketing/DemoVideoSection";
import { getFeaturedItOpsVideos } from "@/lib/itOpsVideoFeed";
import { NepaliTechNewsWidget } from "@/components/marketing/NepaliTechNewsWidget";
import { ServiceCard } from "@/components/marketing/ServiceCard";
import { WhyChooseUsCard } from "@/components/marketing/WhyChooseUsCard";
import { SERVICE_KEYS, SERVICE_ICONS, WHY_CHOOSE_US_KEYS, WHY_CHOOSE_US_ICONS, ABOUT_SOFTWARE_FEATURE_KEYS } from "@/lib/websiteContent";
import { MKT } from "@/lib/marketingTheme";
import type { SlideData } from "@/components/marketing/Slider";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

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
  const [itOpsVideo] = await getFeaturedItOpsVideos(1);
  const slides: SlideData[] = result.recordset.map((r) => ({
    id: r.Id,
    title: r.Title,
    subtitle: r.Subtitle,
    buttonText: r.ButtonText,
    buttonUrl: r.ButtonUrl,
    imagePath: r.ImagePath,
  }));

  const t = await getTranslations("home");
  const tFeatures = await getTranslations("aboutSoftwareFeatures");
  const tServices = await getTranslations("services.items");
  const tWhy = await getTranslations("whyChooseUs");

  return (
    <div>
      <KnowledgeHub />
      <Hero slides={slides} />

      <section style={{ padding: "3.5rem 1.25rem", maxWidth: 1200, margin: "0 auto" }}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
          <div style={{ minWidth: 0 }}>
            <div style={{ maxWidth: 700, marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>{t("aboutTitle")}</h2>
              <p style={{ color: MKT.inkMuted, fontSize: "0.98rem", lineHeight: 1.6 }}>{t("aboutIntro")}</p>
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {ABOUT_SOFTWARE_FEATURE_KEYS.map((key) => (
                <div key={key} style={{ padding: "1rem 0" }}>
                  <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.35rem" }}>
                    {tFeatures(`${key}.title`)}
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: MKT.inkMuted, margin: 0, lineHeight: 1.55 }}>
                    {tFeatures(`${key}.description`)}
                  </p>
                </div>
              ))}
            </div>
            {itOpsVideo && (
              <DemoVideoSection
                video={{ type: "youtube", videoId: itOpsVideo.videoId, title: itOpsVideo.title }}
                title="Daily IT Ops & Security Pick"
                description={`A fresh video each day from top networking and cybersecurity educators, picked to help IT teams stay sharp. Today: "${itOpsVideo.title}" from ${itOpsVideo.sourceName}.`}
                watchDemoLabel="Play Video"
                documentationLabel="Documentation"
                contactSalesLabel="Contact Sales"
              />
            )}
          </div>
          <div className="flex flex-col gap-6">
            <DevAiNewsWidget />
            <AiVideoPicksWidget />
          </div>
        </div>
      </section>

      <NepaliTechNewsWidget />

      <section style={{ background: MKT.surface, padding: "3.5rem 1.25rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="text-center" style={{ maxWidth: 700, margin: "0 auto 2rem" }}>
            <h2 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>{t("servicesTitle")}</h2>
          </div>
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {SERVICE_KEYS.map((key) => (
              <ServiceCard key={key} icon={SERVICE_ICONS[key]} title={tServices(`${key}.title`)} description={tServices(`${key}.description`)} />
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "3.5rem 1.25rem", maxWidth: 1200, margin: "0 auto" }}>
        <div className="text-center" style={{ maxWidth: 700, margin: "0 auto 2rem" }}>
          <h2 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>{t("whyChooseTitle")}</h2>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {WHY_CHOOSE_US_KEYS.map((key) => (
            <WhyChooseUsCard key={key} icon={WHY_CHOOSE_US_ICONS[key]} title={tWhy(key)} />
          ))}
        </div>
      </section>

      <section style={{ background: MKT.ink, padding: "3rem 1.25rem", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>{t("ctaTitle")}</h2>
        <p style={{ color: "#94A3B8", marginBottom: "1.5rem" }}>{t("ctaSubtitle")}</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/login" style={{ background: MKT.primary, color: "#fff", padding: "0.7rem 1.4rem", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            {t("ctaLogin")}
          </Link>
          <Link href="/contact" style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", padding: "0.7rem 1.4rem", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
            {t("ctaContact")}
          </Link>
        </div>
      </section>
    </div>
  );
}
