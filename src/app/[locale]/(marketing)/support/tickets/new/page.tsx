import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MKT } from "@/lib/marketingTheme";
import { TicketForm } from "@/components/marketing/TicketForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "newTicket" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function NewTicketPage() {
  const t = await getTranslations("newTicket");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.9rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.5rem" }}>{t("title")}</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "0.95rem", marginBottom: "2rem" }}>{t("intro")}</p>
      <div style={{ background: "#fff", border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
        <TicketForm />
      </div>
    </div>
  );
}
