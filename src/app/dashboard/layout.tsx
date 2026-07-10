import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { getDb } from "@/lib/db";
import { DEFAULT_DISPLAY_SETTINGS, type DisplaySettings } from "@/lib/dateFormat";
import SidebarShell from "@/components/SidebarShell";
import LogoutButton from "@/components/LogoutButton";
import Header from "@/components/Header";
import IdleLogout from "@/components/IdleLogout";

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

  return (
    <div className="dash-shell">
      <IdleLogout />
      <SidebarShell>
        <div className="dash-user">
          <div className="name">
            {session.user?.name}
            <div className="role">{(session.user as { role?: string })?.role ?? "User"}</div>
          </div>
          <LogoutButton />
        </div>
      </SidebarShell>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header userName={session.user?.name ?? "User"} displaySettings={displaySettings} />
        <main className="dash-content">{children}</main>
      </div>
    </div>
  );
}
