import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import { ABOUT_US_MISSION_POINT_KEYS } from "@/lib/websiteContent";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutUs" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function AboutUsPage() {
  const t = await getTranslations("aboutUs");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "1.5rem" }}>{t("title")}</h1>

      <p style={{ color: MKT.ink, fontSize: "1.02rem", lineHeight: 1.75, marginBottom: "1.1rem" }}>{t("intro")}</p>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.75, marginBottom: "1.1rem" }}>{t("combined")}</p>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.75, marginBottom: "2.5rem" }}>{t("missionStatement")}</p>

      <div className="grid gap-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div style={{ background: MKT.surface, border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.75rem" }}>{t("visionTitle")}</h2>
          <p style={{ fontSize: "0.92rem", color: MKT.inkMuted, lineHeight: 1.65, margin: 0 }}>{t("vision")}</p>
        </div>

        <div style={{ background: MKT.surface, border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.75rem" }}>{t("missionTitle")}</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {ABOUT_US_MISSION_POINT_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2" style={{ fontSize: "0.92rem", color: MKT.inkMuted }}>
                <CheckCircle2 size={16} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
                {t(`missionPoints.${key}`)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
