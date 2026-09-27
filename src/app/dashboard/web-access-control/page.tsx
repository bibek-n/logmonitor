import { getWebAccessControlSession } from "@/lib/requireWebAccessControlPermission";
import { WacDashboardClient } from "@/components/webAccessControl/DashboardClient";

export const dynamic = "force-dynamic";

export default async function WebAccessControlDashboardPage() {
  const wac = await getWebAccessControlSession("wac_view");
  if (!wac) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Web Access Control</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Web Access Control.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Web Access Control</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Staff-based website access management - Staff Groups, website Allow/Block rules, a Critical Application
        Allowlist, and Schedules. Rules are enforced by this app&apos;s own model; Sophos Firewall synchronization is
        not yet connected (see the status below).
      </p>
      <WacDashboardClient />
    </div>
  );
}
