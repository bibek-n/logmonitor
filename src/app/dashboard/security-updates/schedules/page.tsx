import { getSecurityUpdatesAccess } from "@/lib/requireSecurityUpdatesPermission";
import { SecurityUpdatesSchedulesClient } from "@/components/securityUpdates/SecurityUpdatesSchedulesClient";

export const dynamic = "force-dynamic";

export default async function SecurityUpdatesSchedulesPage() {
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
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Update Schedules</h1>
      <SecurityUpdatesSchedulesClient canSchedule={!!can.su_schedule} />
    </div>
  );
}
