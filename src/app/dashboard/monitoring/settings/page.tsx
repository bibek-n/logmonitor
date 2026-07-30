import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { MonitoringSettingsClient } from "@/components/websiteApiMonitoring/MonitoringSettingsClient";

export const dynamic = "force-dynamic";

export default async function MonitoringSettingsPage() {
  const mon = await getMonitoringSession("mon_settings_manage");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Monitoring Settings</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to manage monitoring settings.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Monitoring Settings</h1>
      <MonitoringSettingsClient />
    </div>
  );
}
