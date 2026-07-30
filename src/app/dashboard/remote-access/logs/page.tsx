import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { ConnectionLogsClient } from "@/components/remoteAccess/ConnectionLogsClient";

export const dynamic = "force-dynamic";

export default async function ConnectionLogsPage() {
  const ra = await getRemoteAccessSession("ra_audit_logs_view");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Connection Logs</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Connection Logs.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Connection Logs</h1>
      <ConnectionLogsClient />
    </div>
  );
}
