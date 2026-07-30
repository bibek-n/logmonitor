import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { ApiMonitorsListClient } from "@/components/websiteApiMonitoring/ApiMonitorsListClient";

export const dynamic = "force-dynamic";

export default async function ApiMonitorsPage() {
  const mon = await getMonitoringSession("mon_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>API Monitors</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Website & API Monitoring.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>API Monitors</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        All 7 HTTP methods, custom headers/query params/request body, API Key/Bearer/Basic/OAuth2 client-credentials
        authentication, and JSONPath response assertions - checked every configured interval by the Website &amp; API
        Monitoring scheduled scan.
      </p>
      <ApiMonitorsListClient />
    </div>
  );
}
