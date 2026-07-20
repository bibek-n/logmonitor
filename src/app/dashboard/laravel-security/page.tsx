import { getLsSession } from "@/lib/requireLaravelSecurityPermission";
import { LaravelSecurityDashboardClient } from "@/components/laravelSecurity/LaravelSecurityDashboardClient";
import { NotAuthorized } from "@/components/shared/NotAuthorized";

export const dynamic = "force-dynamic";

export default async function LaravelSecurityDashboardPage() {
  const ls = await getLsSession("ls_view");
  if (!ls) return <NotAuthorized moduleName="Laravel Security" />;
  return <LaravelSecurityDashboardClient />;
}
