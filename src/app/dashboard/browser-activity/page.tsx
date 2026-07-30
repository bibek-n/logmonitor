import { getBrowserActivityAccess } from "@/lib/requireBrowserActivityPermission";
import { DashboardClient } from "@/components/browserActivity/DashboardClient";

export const dynamic = "force-dynamic";

export default async function BrowserActivityDashboardPage() {
  const { browserActivity, can } = await getBrowserActivityAccess();
  if (!browserActivity) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Browser Activity Audit</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view browser activity data.</p>
      </div>
    );
  }

  return (
    <div>
      <DashboardClient canViewSecurityAlerts={can.ba_view_security_alerts} />
    </div>
  );
}
