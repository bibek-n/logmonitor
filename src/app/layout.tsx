import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NO_FLASH_THEME_SCRIPT, DEFAULT_THEME, THEME_STORAGE_KEY, isValidTheme } from "@/lib/themes";
import { routing } from "@/i18n/routing";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Log Monitor",
  description: "Server log monitoring dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The dashboard (non-locale-prefixed) doesn't render inside [locale], so this root
  // layout is the only place that can set <html lang> — read the next-intl cookie
  // directly rather than via route params, which the dashboard tree never provides.
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const lang =
    cookieLocale && (routing.locales as readonly string[]).includes(cookieLocale) ? cookieLocale : routing.defaultLocale;

  // Theme is read the same way as lang above: from a cookie, server-side, so the correct
  // theme is already part of the very first HTML byte sent — no client JS has to run for it
  // to be right on load. This replaced a localStorage-only + inline-script approach that
  // silently failed to persist for anyone whose browser restricts localStorage (the inline
  // script's write was wrapped in a try/catch that swallowed the failure, so the theme
  // *looked* applied — the DOM attribute was set directly by the click handler — right up
  // until the next reload, when there was nothing in storage to restore from). Cookies are
  // far less commonly blocked, and reading one server-side needs no client script at all.
  const cookieTheme = cookieStore.get(THEME_STORAGE_KEY)?.value ?? null;
  const initialTheme = isValidTheme(cookieTheme) ? cookieTheme : DEFAULT_THEME;

  return (
    <html lang={lang} data-theme={initialTheme} className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Fallback only, for a theme saved before this cookie-based approach shipped
            (localStorage still has it, no cookie yet) — migrates it into the cookie/DOM
            attribute on this one load; every subsequent load gets it straight from the
            server via the cookie above, no client JS involved. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body style={{ fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
