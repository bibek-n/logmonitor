import { getOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import { IncidentsListClient } from "@/components/opsIncidents/IncidentsListClient";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const oi = await getOpsIncidentsSession("oi_view");
  if (!oi) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Incidents</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view this page.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Incidents</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Create an incident from one or more Security Alerts, or fully manually. Tracks owner, timeline, attachments, and
        a post-incident summary separate from the alerts/monitor outages that may have triggered it.
      </p>
      <IncidentsListClient />
    </div>
  );
}
