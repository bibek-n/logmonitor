import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es", "fr", "de", "ne", "hi"],
  defaultLocale: "en",
});

export type AppLocale = (typeof routing.locales)[number];
