import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { AlertContactsClient } from "@/components/websiteApiMonitoring/AlertContactsClient";

export const dynamic = "force-dynamic";

export default async function AlertContactsPage() {
  const mon = await getMonitoringSession("mon_alert_contacts_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Alert Contacts</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view alert contacts.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Alert Contacts</h1>
      <AlertContactsClient />
    </div>
  );
}
