import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { MKT } from "@/lib/marketingTheme";
import { Slider, type SlideData } from "./Slider";

export function Hero({ slides }: { slides: SlideData[] }) {
  const t = useTranslations("home");

  return (
    <section style={{ background: MKT.surface, padding: "3rem 1.25rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="text-center" style={{ maxWidth: 780, margin: "0 auto 2rem" }}>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: MKT.ink, lineHeight: 1.15, marginBottom: "1rem" }}>
            {t("heroTitle")}
          </h1>
          <p style={{ fontSize: "1.05rem", color: MKT.inkMuted, lineHeight: 1.6, marginBottom: "1.75rem" }}>
            {t("heroSubtitle")}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/about-software"
              style={{
                background: MKT.primary,
                color: "#fff",
                padding: "0.75rem 1.5rem",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              {t("heroLearnMore")} <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              style={{
                background: "#fff",
                color: MKT.ink,
                border: `1px solid ${MKT.border}`,
                padding: "0.75rem 1.5rem",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              {t("heroLogin")}
            </Link>
          </div>
        </div>

        <Slider slides={slides} />
      </div>
    </section>
  );
}
