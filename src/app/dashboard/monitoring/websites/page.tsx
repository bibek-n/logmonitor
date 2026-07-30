import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { WebsiteMonitorsListClient } from "@/components/websiteApiMonitoring/WebsiteMonitorsListClient";

export const dynamic = "force-dynamic";

export default async function WebsiteMonitorsPage() {
  const mon = await getMonitoringSession("mon_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Website Monitors</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Website & API Monitoring.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Website Monitors</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Checked every configured interval by the Website &amp; API Monitoring scheduled scan.
      </p>
      <WebsiteMonitorsListClient />
    </div>
  );
}
