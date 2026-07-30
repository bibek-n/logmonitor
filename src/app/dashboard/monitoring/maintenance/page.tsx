import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { MaintenanceWindowsClient } from "@/components/websiteApiMonitoring/MaintenanceWindowsClient";

export const dynamic = "force-dynamic";

export default async function MaintenanceWindowsPage() {
  const mon = await getMonitoringSession("mon_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Maintenance Windows</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Website & API Monitoring.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Maintenance Windows</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        A monitor inside an active window is marked Maintenance, skipped by checks, and its alerts are suppressed for the
        duration. Times are entered in the server&apos;s local time.
      </p>
      <MaintenanceWindowsClient />
    </div>
  );
}
