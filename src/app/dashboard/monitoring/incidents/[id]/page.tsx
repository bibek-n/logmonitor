import { notFound } from "next/navigation";
import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { IncidentDetailClient } from "@/components/websiteApiMonitoring/IncidentDetailClient";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mon = await getMonitoringSession("mon_incidents_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Incident</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view incidents.</p>
      </div>
    );
  }

  const incidentId = Number(id);
  if (!Number.isInteger(incidentId)) notFound();

  return <IncidentDetailClient incidentId={incidentId} />;
}
