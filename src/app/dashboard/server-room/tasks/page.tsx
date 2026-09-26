import { getServerRoomAccess } from "@/lib/requireServerRoomPermission";
import { ServerRoomTasksClient } from "@/components/serverRoom/ServerRoomTasksClient";

export const dynamic = "force-dynamic";

export default async function ServerRoomTasksPage() {
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
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Tasks</h1>
      <ServerRoomTasksClient canRecord={!!can.sr_record} canIncident={!!can.sr_incidents} />
    </div>
  );
}
