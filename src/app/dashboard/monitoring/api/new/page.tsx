import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { ApiMonitorFormClient } from "@/components/websiteApiMonitoring/ApiMonitorFormClient";

export const dynamic = "force-dynamic";

export default async function NewApiMonitorPage() {
  const mon = await getMonitoringSession("mon_api_create");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>New API Monitor</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to create API monitors.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>New API Monitor</h1>
      <ApiMonitorFormClient monitorId="new" />
    </div>
  );
}
