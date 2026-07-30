import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { NotificationLogsClient } from "@/components/websiteApiMonitoring/NotificationLogsClient";

export const dynamic = "force-dynamic";

export default async function NotificationLogsPage() {
  const mon = await getMonitoringSession("mon_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Notification Logs</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Website & API Monitoring.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Notification Logs</h1>
      <NotificationLogsClient />
    </div>
  );
}
