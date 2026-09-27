import { getWebAccessControlSession } from "@/lib/requireWebAccessControlPermission";
import { WacAuditLogClient } from "@/components/webAccessControl/AuditLogClient";

export const dynamic = "force-dynamic";

export default async function WebAccessControlAuditLogPage() {
  const wac = await getWebAccessControlSession("wac_audit_log_view");
  if (!wac) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Audit Log</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to the Web Access Control audit log.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Audit Log</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Every create/update/delete/enable/disable across Staff Groups, Website Rules, the Critical Allowlist, and
        Schedules - pulled from the shared admin audit log (Section = &quot;web-access-control&quot;).
      </p>
      <WacAuditLogClient />
    </div>
  );
}
