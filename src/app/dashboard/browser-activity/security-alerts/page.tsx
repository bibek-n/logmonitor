import { getBrowserActivitySession } from "@/lib/requireBrowserActivityPermission";
import { SecurityAlertsClient } from "@/components/browserActivity/SecurityAlertsClient";

export const dynamic = "force-dynamic";

export default async function BrowserActivitySecurityAlertsPage() {
  const ba = await getBrowserActivitySession("ba_view_security_alerts");
  if (!ba) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Security Alerts</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view browser activity security alerts.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Security Alerts</h1>
      <SecurityAlertsClient />
    </div>
  );
}
