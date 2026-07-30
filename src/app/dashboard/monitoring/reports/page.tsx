import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { ReportsClient } from "@/components/websiteApiMonitoring/ReportsClient";

export const dynamic = "force-dynamic";

export default async function MonitoringReportsPage() {
  const mon = await getMonitoringSession("mon_reports_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Reports</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Website & API Monitoring reports.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Reports</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        On-demand CSV/Excel/PDF export, recurring scheduled reports, and SLA target tracking.
      </p>
      <ReportsClient />
    </div>
  );
}
