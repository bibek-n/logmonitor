import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MKT } from "@/lib/marketingTheme";
import { SERVICE_KEYS, SERVICE_ICONS } from "@/lib/websiteContent";
import { ServiceCard } from "@/components/marketing/ServiceCard";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ServicesPage() {
  const t = await getTranslations("services");
  const tItems = await getTranslations("services.items");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>{t("title")}</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 720 }}>
        {t("intro")}
      </p>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {SERVICE_KEYS.map((key) => (
          <ServiceCard key={key} icon={SERVICE_ICONS[key]} title={tItems(`${key}.title`)} description={tItems(`${key}.description`)} />
        ))}
      </div>
    </div>
  );
}
