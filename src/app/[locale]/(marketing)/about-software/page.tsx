import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MKT } from "@/lib/marketingTheme";
import { ABOUT_SOFTWARE_FEATURE_KEYS } from "@/lib/websiteContent";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "aboutSoftware" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function AboutSoftwarePage() {
  const t = await getTranslations("aboutSoftware");
  const tFeatures = await getTranslations("aboutSoftwareFeatures");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>{t("title")}</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 720 }}>
        {t("intro")}
      </p>

      <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {ABOUT_SOFTWARE_FEATURE_KEYS.map((key) => (
          <div key={key} style={{ border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.25rem" }}>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.5rem" }}>
              {tFeatures(`${key}.title`)}
            </h2>
            <p style={{ fontSize: "0.9rem", color: MKT.inkMuted, margin: 0, lineHeight: 1.6 }}>
              {tFeatures(`${key}.description`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
