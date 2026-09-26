import { getServerRoomAccess } from "@/lib/requireServerRoomPermission";
import { ServerRoomAuditClient } from "@/components/serverRoom/ServerRoomAuditClient";

export const dynamic = "force-dynamic";

export default async function ServerRoomAuditPage() {
  const { sr, can } = await getServerRoomAccess();
  if (!sr || !can.sr_audit) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Server Room</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Audit History</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>
          Server room entries, technical / hosting / security tasks, update scans and installs, failed and firmware updates, and incident activity - searchable by date, staff, device, task type, OS and Incident ID.
        </p>
      </div>
      <ServerRoomAuditClient canExport={!!can.sr_export} />
    </div>
  );
}
