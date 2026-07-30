import { getBrowserActivitySession } from "@/lib/requireBrowserActivityPermission";
import { AuditLogClient } from "@/components/browserActivity/AuditLogClient";

export const dynamic = "force-dynamic";

export default async function BrowserActivityAuditLogPage() {
  const ba = await getBrowserActivitySession("ba_audit_log_view");
  if (!ba) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Audit Log</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view the browser activity audit log.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Audit Log</h1>
      <AuditLogClient />
    </div>
  );
}
