import { getLsSession, getLsAccess } from "@/lib/requireLaravelSecurityPermission";
import { NotAuthorized } from "@/components/shared/NotAuthorized";
import { SettingsClient } from "@/components/laravelSecurity/SettingsClient";

export const dynamic = "force-dynamic";

export default async function LaravelSecuritySettingsPage() {
  const ls = await getLsSession("ls_view");
  if (!ls) return <NotAuthorized moduleName="Laravel Security" />;
  const { can } = await getLsAccess();
  return <SettingsClient canManage={can.ls_settings_manage} />;
}
