import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MKT } from "@/lib/marketingTheme";
import { TicketStatusLookup } from "@/components/marketing/TicketStatusLookup";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ticketStatus" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function TicketStatusPage() {
  const t = await getTranslations("ticketStatus");

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.5rem" }}>{t("title")}</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "0.95rem", marginBottom: "2rem" }}>{t("intro")}</p>
      <TicketStatusLookup />
    </div>
  );
}
