import { notFound } from "next/navigation";
import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { ApiMonitorDetailClient } from "@/components/websiteApiMonitoring/ApiMonitorDetailClient";

export const dynamic = "force-dynamic";

export default async function ApiMonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mon = await getMonitoringSession("mon_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>API Monitor</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Website & API Monitoring.</p>
      </div>
    );
  }

  const monitorId = Number(id);
  if (!Number.isInteger(monitorId)) notFound();

  return <ApiMonitorDetailClient monitorId={monitorId} />;
}
