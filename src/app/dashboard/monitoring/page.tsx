import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { OverviewClient } from "@/components/websiteApiMonitoring/OverviewClient";

export const dynamic = "force-dynamic";

export default async function MonitoringOverviewPage() {
  const mon = await getMonitoringSession("mon_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Website & API Monitoring</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Website & API Monitoring.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Overview</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Stage 1: website monitoring only (availability, response time, content, SSL). API monitoring, maintenance
        windows, and reports arrive in later phases.
      </p>
      <OverviewClient />
    </div>
  );
}
