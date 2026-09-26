import { getSecurityUpdatesAccess } from "@/lib/requireSecurityUpdatesPermission";
import { SecurityUpdatesDashboardClient } from "@/components/securityUpdates/SecurityUpdatesDashboardClient";

export const dynamic = "force-dynamic";

export default async function SecurityUpdatesDashboardPage() {
  const { su, can } = await getSecurityUpdatesAccess();
  if (!su) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Security &amp; Updates</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Security &amp; Updates</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>
          Pending, failed and restart-required updates across Windows, macOS and Linux devices, reported by the endpoint agent.
        </p>
      </div>
      <SecurityUpdatesDashboardClient canScan={!!can.su_scan} />
    </div>
  );
}
