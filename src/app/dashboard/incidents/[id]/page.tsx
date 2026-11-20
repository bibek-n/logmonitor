import { getOpsIncidentsSession } from "@/lib/requireOpsIncidentsPermission";
import IncidentDetailClient from "@/components/opsIncidents/IncidentDetailClient";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const oi = await getOpsIncidentsSession("oi_view");
  if (!oi) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Incident</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view this page.</p>
      </div>
    );
  }

  const { id } = await params;
  return <IncidentDetailClient incidentId={Number(id)} />;
}
