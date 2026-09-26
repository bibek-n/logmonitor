import { getSecurityUpdatesAccess } from "@/lib/requireSecurityUpdatesPermission";
import { SecurityUpdatesHistoryClient } from "@/components/securityUpdates/SecurityUpdatesHistoryClient";

export const dynamic = "force-dynamic";

export default async function SecurityUpdatesHistoryPage() {
  const { su, can } = await getSecurityUpdatesAccess();
  if (!su || !can.su_history) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Security &amp; Updates</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Update History</h1>
      <SecurityUpdatesHistoryClient canExport={!!can.su_export} />
    </div>
  );
}
