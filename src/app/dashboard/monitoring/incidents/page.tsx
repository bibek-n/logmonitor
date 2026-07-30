import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { IncidentsListClient } from "@/components/websiteApiMonitoring/IncidentsListClient";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const mon = await getMonitoringSession("mon_incidents_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Incidents</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view incidents.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Incidents</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Automatically opened when a monitor confirms Down, and automatically resolved on recovery. Manual acknowledge/assign/notes workflow arrives in a later phase.
      </p>
      <IncidentsListClient />
    </div>
  );
}
