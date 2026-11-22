import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FOOTER_LINKS } from "@/lib/websiteContent";
import { getContactInfo } from "@/lib/websiteContactInfo";
import { MKT } from "@/lib/marketingTheme";
import { getDb } from "@/lib/db";
import { TulipsLogo } from "@/components/branding/TulipsLogo";

async function getFooterSettings(): Promise<{ footerText: string | null; companyName: string | null; logoPath: string | null }> {
  try {
    const db = await getDb();
    const result = await db.query<{ FooterText: string | null; CompanyName: string | null; LogoPath: string | null }>`
      SELECT FooterText, CompanyName, LogoPath FROM CompanySettings WHERE Id = 1
    `;
    const row = result.recordset[0];
    return { footerText: row?.FooterText ?? null, companyName: row?.CompanyName ?? null, logoPath: row?.LogoPath ?? null };
  } catch {
    return { footerText: null, companyName: null, logoPath: null };
  }
}

export async function PublicFooter() {
  const year = new Date().getUTCFullYear();
  const [{ footerText, companyName, logoPath }, contact] = await Promise.all([getFooterSettings(), getContactInfo()]);
  const t = await getTranslations("nav");
  const tf = await getTranslations("footer");

  return (
    <footer style={{ background: MKT.surface, color: MKT.inkMuted, marginTop: "auto" }}>
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
          <div style={{ marginBottom: "0.9rem" }}>
            <TulipsLogo height={26} padded src={logoPath} alt={companyName} />
          </div>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: MKT.inkMuted }}>{tf("tagline")}</p>
        </div>

        <div>
          <h3 style={{ color: MKT.ink, fontSize: "0.9rem", marginBottom: "0.75rem" }}>{tf("quickLinksTitle")}</h3>
          <div className="flex flex-col gap-2" style={{ fontSize: "0.85rem" }}>
            {FOOTER_LINKS.quickLinks.map((l) => (
              <Link key={l.href} href={l.href} style={{ color: MKT.inkMuted, textDecoration: "none" }}>
                {t(l.key)}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ color: MKT.ink, fontSize: "0.9rem", marginBottom: "0.75rem" }}>{tf("legalTitle")}</h3>
          <div className="flex flex-col gap-2" style={{ fontSize: "0.85rem" }}>
            {FOOTER_LINKS.legal.map((l) => (
              <Link key={l.href} href={l.href} style={{ color: MKT.inkMuted, textDecoration: "none" }}>
                {t(l.key)}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ color: MKT.ink, fontSize: "0.9rem", marginBottom: "0.75rem" }}>{tf("contactTitle")}</h3>
          <div className="flex flex-col gap-2" style={{ fontSize: "0.85rem", color: MKT.inkMuted }}>
            {contact.address && <span>{contact.address}</span>}
            {contact.phone && <span>{contact.phone}</span>}
            {contact.email && <span>{contact.email}</span>}
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${MKT.border}`,
          padding: "1rem 1.25rem",
          textAlign: "center",
          fontSize: "0.78rem",
          color: MKT.inkMuted,
        }}
      >
        &copy; {year} {tf("copyright")}
        {footerText && <div style={{ marginTop: "0.4rem", color: MKT.inkMuted }}>{footerText}</div>}
      </div>
    </footer>
  );
}
