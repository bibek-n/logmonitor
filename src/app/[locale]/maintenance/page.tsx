import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Wrench } from "lucide-react";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "maintenance" });
  return { title: t("metaTitle") };
}

async function getMaintenanceMessage(): Promise<string | null> {
  try {
    const db = await getDb();
    const result = await db.query<{ MaintenanceMessage: string | null }>`SELECT MaintenanceMessage FROM CompanySettings WHERE Id = 1`;
    return result.recordset[0]?.MaintenanceMessage || null;
  } catch {
    return null;
  }
}

export default async function MaintenancePage() {
  const [message, t] = await Promise.all([getMaintenanceMessage(), getTranslations("maintenance")]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0F172A",
        color: "#fff",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <Wrench size={40} color="#3B82F6" style={{ marginBottom: "1rem" }} />
      <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: "0.75rem" }}>{t("title")}</h1>
      <p style={{ color: "#94A3B8", maxWidth: 480, lineHeight: 1.6 }}>{message ?? t("defaultMessage")}</p>
    </div>
  );
}
