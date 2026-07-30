import { getSecurityCenterSession } from "@/lib/requireSecurityCenterPermission";
import { SecurityDashboardClient } from "@/components/securityCenter/SecurityDashboardClient";

export const dynamic = "force-dynamic";

export default async function SecurityCenterDashboardPage() {
  const sc = await getSecurityCenterSession("sc_view");
  if (!sc) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Security Center</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view the Security Center dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Security Center</h1>
      <SecurityDashboardClient />
    </div>
  );
}
