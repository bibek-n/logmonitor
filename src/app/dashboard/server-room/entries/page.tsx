import { getServerRoomAccess } from "@/lib/requireServerRoomPermission";
import { ServerRoomEntriesClient } from "@/components/serverRoom/ServerRoomEntriesClient";

export const dynamic = "force-dynamic";

export default async function ServerRoomEntriesPage() {
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
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Server Room Entries</h1>
      <ServerRoomEntriesClient canRecord={!!can.sr_record} />
    </div>
  );
}
