import { getTranslations } from "next-intl/server";
import { Activity } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FOOTER_LINKS, CONTACT_INFO } from "@/lib/websiteContent";
import { MKT } from "@/lib/marketingTheme";
import { getDb } from "@/lib/db";

async function getFooterText(): Promise<string | null> {
  try {
    const db = await getDb();
    const result = await db.query<{ FooterText: string | null }>`SELECT FooterText FROM CompanySettings WHERE Id = 1`;
    return result.recordset[0]?.FooterText ?? null;
  } catch {
    return null;
  }
}

export async function PublicFooter() {
  const year = new Date().getUTCFullYear();
  const footerText = await getFooterText();
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");

  return (
    <footer style={{ background: MKT.ink, color: "#CBD5E1", marginTop: "auto" }}>
      <div
        className="grid gap-8"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "3rem 1.25rem 2rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        }}
      >
        <div>
          <div className="flex items-center gap-2" style={{ color: "#fff", fontWeight: 700, marginBottom: "0.75rem" }}>
            <Activity size={20} style={{ color: MKT.primary }} />
            <span>Log Monitor</span>
          </div>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "#94A3B8" }}>{tf("tagline")}</p>
        </div>

        <div>
          <h3 style={{ color: "#fff", fontSize: "0.9rem", marginBottom: "0.75rem" }}>{tf("quickLinksTitle")}</h3>
          <div className="flex flex-col gap-2" style={{ fontSize: "0.85rem" }}>
            {FOOTER_LINKS.quickLinks.map((l) => (
              <Link key={l.href} href={l.href} style={{ color: "#94A3B8", textDecoration: "none" }}>
                {t(l.key)}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ color: "#fff", fontSize: "0.9rem", marginBottom: "0.75rem" }}>{tf("legalTitle")}</h3>
          <div className="flex flex-col gap-2" style={{ fontSize: "0.85rem" }}>
            {FOOTER_LINKS.legal.map((l) => (
              <Link key={l.href} href={l.href} style={{ color: "#94A3B8", textDecoration: "none" }}>
                {t(l.key)}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ color: "#fff", fontSize: "0.9rem", marginBottom: "0.75rem" }}>{tf("contactTitle")}</h3>
          <div className="flex flex-col gap-2" style={{ fontSize: "0.85rem", color: "#94A3B8" }}>
            <span>{CONTACT_INFO.address}</span>
            <span>{CONTACT_INFO.phone}</span>
            <span>{CONTACT_INFO.email}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          padding: "1rem 1.25rem",
          textAlign: "center",
          fontSize: "0.78rem",
          color: "#64748B",
        }}
      >
        &copy; {year} {tf("copyright")}
        {footerText && <div style={{ marginTop: "0.4rem", color: "#94A3B8" }}>{footerText}</div>}
      </div>
    </footer>
  );
}
