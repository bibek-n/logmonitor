"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { MKT } from "@/lib/marketingTheme";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("languageSwitcher");

  return (
    <select
      aria-label={t("label")}
      value={locale}
      onChange={(e) => router.replace(pathname, { locale: e.target.value })}
      style={{
        background: "transparent",
        border: `1px solid ${MKT.border}`,
        borderRadius: 8,
        padding: "0.35rem 0.5rem",
        fontSize: "0.82rem",
        color: MKT.ink,
        cursor: "pointer",
      }}
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {t(l)}
        </option>
      ))}
    </select>
  );
}
