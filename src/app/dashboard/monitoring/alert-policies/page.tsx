import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { AlertPoliciesClient } from "@/components/websiteApiMonitoring/AlertPoliciesClient";

export const dynamic = "force-dynamic";

export default async function AlertPoliciesPage() {
  const mon = await getMonitoringSession("mon_alert_contacts_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Alert Policies</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view alert policies.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Alert Policies</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Which contacts get notified for a monitor, plus optional quiet hours and escalation. Assign a policy to a monitor from its
        edit page; monitors with no policy set use whichever policy is marked Default.
      </p>
      <AlertPoliciesClient />
    </div>
  );
}
