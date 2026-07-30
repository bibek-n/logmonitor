import { notFound } from "next/navigation";
import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { MonitorDetailClient } from "@/components/websiteApiMonitoring/MonitorDetailClient";

export const dynamic = "force-dynamic";

export default async function WebsiteMonitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mon = await getMonitoringSession("mon_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Website Monitor</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Website & API Monitoring.</p>
      </div>
    );
  }

  const monitorId = Number(id);
  if (!Number.isInteger(monitorId)) notFound();

  return <MonitorDetailClient monitorId={monitorId} />;
}
