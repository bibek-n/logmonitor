import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookOpen, HelpCircle, FileText, Mail, Ticket } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { MKT } from "@/lib/marketingTheme";
import { CONTACT_INFO, SUPPORT_GUIDE_KEYS, SUPPORT_FAQ_KEYS } from "@/lib/websiteContent";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "support" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

function OptionCard({ icon: Icon, title, description, href, linkLabel }: { icon: typeof BookOpen; title: string; description: string; href: string; linkLabel: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.5rem" }}>
      <Icon size={26} style={{ color: MKT.primary, marginBottom: "0.75rem" }} />
      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.4rem" }}>{title}</h3>
      <p style={{ fontSize: "0.88rem", color: MKT.inkMuted, marginBottom: "0.9rem", lineHeight: 1.55 }}>{description}</p>
      <Link href={href} style={{ color: MKT.primary, fontWeight: 600, fontSize: "0.88rem", textDecoration: "none" }}>
        {linkLabel} →
      </Link>
    </div>
  );
}

export default async function SupportPage() {
  const t = await getTranslations("support");
  const tFaqs = await getTranslations("support.faqs");
  const tGuides = await getTranslations("support.guides");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, color: MKT.ink, marginBottom: "0.75rem" }}>{t("title")}</h1>
      <p style={{ color: MKT.inkMuted, fontSize: "1rem", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 720 }}>
        {t("intro")}
      </p>

      <div className="grid gap-5 mb-10" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <OptionCard icon={BookOpen} title={t("knowledgeBaseTitle")} description={t("knowledgeBaseDesc")} href="#guides" linkLabel={t("knowledgeBaseLink")} />
        <OptionCard icon={HelpCircle} title={t("faqCardTitle")} description={t("faqCardDesc")} href="#faq" linkLabel={t("faqCardLink")} />
        <OptionCard icon={Ticket} title={t("submitTicketTitle")} description={t("submitTicketDesc")} href="/support/tickets/new" linkLabel={t("submitTicketLink")} />
        <OptionCard icon={FileText} title={t("checkStatusTitle")} description={t("checkStatusDesc")} href="/support/tickets/status" linkLabel={t("checkStatusLink")} />
      </div>

      <h2 id="guides" style={{ fontSize: "1.3rem", fontWeight: 700, color: MKT.ink, marginBottom: "1rem" }}>
        {t("guidesTitle")}
      </h2>
      <ul style={{ marginBottom: "2.5rem", paddingLeft: "1.25rem", color: MKT.inkMuted, fontSize: "0.95rem", lineHeight: 1.9 }}>
        {SUPPORT_GUIDE_KEYS.map((key) => (
          <li key={key}>{tGuides(key)}</li>
        ))}
      </ul>

      <h2 id="faq" style={{ fontSize: "1.3rem", fontWeight: 700, color: MKT.ink, marginBottom: "1rem" }}>
        {t("faqTitle")}
      </h2>
      <div className="flex flex-col gap-4 mb-10">
        {SUPPORT_FAQ_KEYS.map((key) => (
          <div key={key} style={{ borderBottom: `1px solid ${MKT.border}`, paddingBottom: "1rem" }}>
            <h3 style={{ fontSize: "0.98rem", fontWeight: 700, color: MKT.ink, marginBottom: "0.4rem" }}>{tFaqs(`${key}.question`)}</h3>
            <p style={{ fontSize: "0.9rem", color: MKT.inkMuted, margin: 0, lineHeight: 1.6 }}>{tFaqs(`${key}.answer`)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2" style={{ color: MKT.inkMuted, fontSize: "0.9rem" }}>
        <Mail size={16} /> {t("stillNeedHelp")}{" "}
        <a href={`mailto:${CONTACT_INFO.email}`} style={{ color: MKT.primary }}>
          {CONTACT_INFO.email}
        </a>
      </div>
    </div>
  );
}
