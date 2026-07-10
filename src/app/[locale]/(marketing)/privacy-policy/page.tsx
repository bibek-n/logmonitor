import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MKT } from "@/lib/marketingTheme";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacyPolicy" });
  return { title: t("metaTitle") };
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("privacyPolicy");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: MKT.ink, marginBottom: "1rem" }}>{t("title")}</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "0.92rem", lineHeight: 1.7 }}>{t("body")}</p>
    </div>
  );
}
