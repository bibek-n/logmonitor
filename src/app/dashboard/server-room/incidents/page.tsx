import { getServerRoomAccess } from "@/lib/requireServerRoomPermission";
import { ServerRoomIncidentsClient } from "@/components/serverRoom/ServerRoomIncidentsClient";

export const dynamic = "force-dynamic";

export default async function ServerRoomIncidentsPage() {
  const { sr, can } = await getServerRoomAccess();
  if (!sr) {
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
        <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Incidents</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>
          Each incident (INC-YYYY-NNNNNN) ties together the device, the finding, the update, the staff member, the task, the action and the resolution.
        </p>
      </div>
      <ServerRoomIncidentsClient canManage={!!can.sr_incidents} />
    </div>
  );
}
