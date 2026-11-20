import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { authOptions } from "@/lib/authOptions";
import { getDb } from "@/lib/db";
import { getQaSession } from "@/lib/requireQaPermission";
import { getCqSession } from "@/lib/requireCodeQualityPermission";
import { getLsSession } from "@/lib/requireLaravelSecurityPermission";
import { getMailSession } from "@/lib/requireMailPolicyPermission";
import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { getAutomationSession } from "@/lib/requireAutomationPermission";
import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { getBrowserActivitySession } from "@/lib/requireBrowserActivityPermission";
import { getAppActivitySession } from "@/lib/requireAppActivityPermission";
import { getWebAccessControlSession } from "@/lib/requireWebAccessControlPermission";
import { getWifiAccessControlSession } from "@/lib/requireWifiAccessControlPermission";
import { getWazuhOfficeSession } from "@/lib/requireWazuhOfficePermission";
import { getWafSession } from "@/lib/requireWafPermission";
import { getSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { getServerRoomSession } from "@/lib/requireServerRoomPermission";
import { getKnowledgeBaseSession } from "@/lib/requireKnowledgeBasePermission";
import { getOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { getWebsiteSecuritySession } from "@/lib/requireWebsiteSecurityPermission";
import { getWordpressScanSession } from "@/lib/requireWordpressScanPermission";
import { getDbAnalyzerSession } from "@/lib/requireDbAnalyzerPermission";
import { getOffboardingSession } from "@/lib/requireOffboardingPermission";
import { getRoleMenuAccessMap, getUserMenuAccessMap, mergeMenuAccess } from "@/lib/roleMenuAccess";
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
  const mailSecurityAccess = await getMailSession("mail_view");
  const monitoringAccess = await getMonitoringSession("mon_view");
  const automationAccess = await getAutomationSession("auto_view");
  const remoteAccessAccess = await getRemoteAccessSession("ra_view");
  const itAssetLogsheetAccess = await getItAssetSession("ita_view");
  const browserActivityAccess = await getBrowserActivitySession("ba_view");
  const appActivityAccess = await getAppActivitySession("aa_view");
  const webAccessControlAccess = await getWebAccessControlSession("wac_view");
  const wifiAccessControlAccess = await getWifiAccessControlSession("wifi_ac_view");
  const wazuhOfficeAccess = await getWazuhOfficeSession("wo_view");
  const wafAccess = await getWafSession("waf_view");
  const securityUpdatesAccess = await getSecurityUpdatesSession("su_view");
  const serverRoomAccess = await getServerRoomSession("sr_view");
  const knowledgeBaseAccess = await getKnowledgeBaseSession("kb_view");
  const opsIncidentsAccess = await getOpsIncidentsSession("oi_view");
  const databaseAnalyzerAccess = await getDbAnalyzerSession("dba_view");
  const offboardingAccess = await getOffboardingSession("off_view");
  // Bundles two independently-permissioned modules under one sidebar subgroup - see
  // GATED_GROUP_KEYS.securityAudits in navRoutes.ts.
  const securityAuditsAccess =
    (await getWebsiteSecuritySession("wsa_view")) !== null || (await getWordpressScanSession("wps_view")) !== null;
  const role = (session.user as { role?: string } | undefined)?.role ?? "";
  const sessionUserId = Number((session.user as { id?: string } | undefined)?.id);
  const roleMenuAccess = role ? await getRoleMenuAccessMap(role) : null;
  // Admin's menu is never restrictable, by itself or by a per-user override - same bypass
  // convention as every other permission check in this codebase.
  const userMenuAccess = role !== "Admin" && Number.isInteger(sessionUserId) ? await getUserMenuAccessMap(sessionUserId) : null;
  const menuAccess = mergeMenuAccess(roleMenuAccess, userMenuAccess);
  // Populates the request-scoped locale so every Server Component under this layout can
  // call getTranslations()/getMessages() with no args and still resolve correctly — the
  // dashboard has no [locale] URL segment, so requestLocale would otherwise never be set.
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DashShellClient>
        <IdleLogout />
        <SidebarShell
          qaAccess={qaAccess !== null}
          codeQualityAccess={codeQualityAccess !== null}
          laravelSecurityAccess={laravelSecurityAccess !== null}
          mailSecurityAccess={mailSecurityAccess !== null}
          monitoringAccess={monitoringAccess !== null}
          automationAccess={automationAccess !== null}
          remoteAccessAccess={remoteAccessAccess !== null}
          itAssetLogsheetAccess={itAssetLogsheetAccess !== null}
          browserActivityAccess={browserActivityAccess !== null}
          appActivityAccess={appActivityAccess !== null}
          webAccessControlAccess={webAccessControlAccess !== null}
          wifiAccessControlAccess={wifiAccessControlAccess !== null}
          wazuhOfficeAccess={wazuhOfficeAccess !== null}
          wafAccess={wafAccess !== null}
          securityUpdatesAccess={securityUpdatesAccess !== null}
          serverRoomAccess={serverRoomAccess !== null}
          knowledgeBaseAccess={knowledgeBaseAccess !== null}
          opsIncidentsAccess={opsIncidentsAccess !== null}
          securityAuditsAccess={securityAuditsAccess}
          databaseAnalyzerAccess={databaseAnalyzerAccess !== null}
          offboardingAccess={offboardingAccess !== null}
          menuAccess={menuAccess}
        >
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
