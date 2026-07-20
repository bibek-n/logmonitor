import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { authOptions } from "@/lib/authOptions";
import { getDb } from "@/lib/db";
import { getQaSession } from "@/lib/requireQaPermission";
import { getCqSession } from "@/lib/requireCodeQualityPermission";
import { getLsSession } from "@/lib/requireLaravelSecurityPermission";
import { DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from "@/lib/dateFormat";
import { resolveLocale } from "@/i18n/routing";
import SidebarShell from "@/components/SidebarShell";
import LogoutButton from "@/components/LogoutButton";
import Header from "@/components/Header";
import IdleLogout from "@/components/IdleLogout";
import DashShellClient from "@/components/DashShellClient";

async function getDisplaySettings(): Promise<DisplaySettings> {
  try {
    const db = await getDb();
    const result = await db.query<{
      DefaultTimezone: string | null;
      DateFormat: string | null;
      TimeFormat: string | null;
      DefaultLanguage: string | null;
    }>`SELECT DefaultTimezone, DateFormat, TimeFormat, DefaultLanguage FROM CompanySettings WHERE Id = 1`;
    const row = result.recordset[0];
    if (!row) return DEFAULT_DISPLAY_SETTINGS;
    return {
      timezone: row.DefaultTimezone || DEFAULT_DISPLAY_SETTINGS.timezone,
      dateFormat: row.DateFormat || DEFAULT_DISPLAY_SETTINGS.dateFormat,
      timeFormat: row.TimeFormat || DEFAULT_DISPLAY_SETTINGS.timeFormat,
      locale: row.DefaultLanguage || DEFAULT_DISPLAY_SETTINGS.locale,
    };
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const displaySettings = await getDisplaySettings();
  const locale = resolveLocale(displaySettings.locale);
  const qaAccess = await getQaSession("qa_view");
  const codeQualityAccess = await getCqSession("cq_view");
  const laravelSecurityAccess = await getLsSession("ls_view");
  // Populates the request-scoped locale so every Server Component under this layout can
  // call getTranslations()/getMessages() with no args and still resolve correctly — the
  // dashboard has no [locale] URL segment, so requestLocale would otherwise never be set.
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DashShellClient>
        <IdleLogout />
        <SidebarShell qaAccess={qaAccess !== null} codeQualityAccess={codeQualityAccess !== null} laravelSecurityAccess={laravelSecurityAccess !== null}>
          <div className="dash-user">
            <div className="name">
              {session.user?.name}
              <div className="role">{(session.user as { role?: string })?.role ?? "User"}</div>
            </div>
            <LogoutButton />
          </div>
        </SidebarShell>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Header userName={session.user?.name ?? "User"} />
          <main className="dash-content">{children}</main>
        </div>
      </DashShellClient>
    </NextIntlClientProvider>
  );
}
