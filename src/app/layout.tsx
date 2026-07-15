import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NO_FLASH_THEME_SCRIPT } from "@/lib/themes";
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

  return (
    <html lang={lang} className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Sets data-theme from localStorage before first paint so switching themes doesn't
            flash the default on reload. Must run synchronously, before hydration. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body style={{ fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
