import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { WebsiteMonitorFormClient } from "@/components/websiteApiMonitoring/WebsiteMonitorFormClient";

export const dynamic = "force-dynamic";

export default async function NewWebsiteMonitorPage() {
  const mon = await getMonitoringSession("mon_website_create");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>New Website Monitor</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to create website monitors.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>New Website Monitor</h1>
      <WebsiteMonitorFormClient monitorId="new" />
    </div>
  );
}
