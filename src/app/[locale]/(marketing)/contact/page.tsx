import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import { CONTACT_INFO } from "@/lib/websiteContent";
import { ContactForm } from "@/components/marketing/ContactForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>{t("title")}</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 720 }}>
        {t("intro")}
      </p>

      <div className="grid gap-8" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)" }}>
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <MapPin size={20} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: MKT.ink, fontSize: "0.92rem" }}>{t("addressLabel")}</div>
              <div style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>{CONTACT_INFO.address}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone size={20} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: MKT.ink, fontSize: "0.92rem" }}>{t("phoneLabel")}</div>
              <div style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>{CONTACT_INFO.phone}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Mail size={20} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: MKT.ink, fontSize: "0.92rem" }}>{t("emailLabel")}</div>
              <div style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>{CONTACT_INFO.email}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={20} style={{ color: MKT.primary, flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: MKT.ink, fontSize: "0.92rem" }}>{t("hoursLabel")}</div>
              <div style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>{CONTACT_INFO.hours}</div>
            </div>
          </div>

          {CONTACT_INFO.mapEmbedUrl ? (
            <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${MKT.border}` }}>
              <iframe
                src={CONTACT_INFO.mapEmbedUrl}
                width="100%"
                height="240"
                style={{ border: 0, display: "block" }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                title="Office location map"
              />
            </div>
          ) : (
            <div
              style={{
                background: MKT.surface,
                border: `1px dashed ${MKT.border}`,
                borderRadius: 10,
                padding: "1.25rem",
                color: MKT.inkMuted,
                fontSize: "0.85rem",
                textAlign: "center",
              }}
            >
              {t("mapPlaceholder")}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
