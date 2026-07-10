import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es", "fr", "de", "ne", "hi"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];

// The dashboard isn't locale-prefixed (see i18n plan) — its active locale comes from
// CompanySettings.DefaultLanguage instead of the URL, validated against this same list.
export function resolveLocale(raw: string | null | undefined): AppLocale {
  if (raw && (routing.locales as readonly string[]).includes(raw)) return raw as AppLocale;
  return routing.defaultLocale;
}
