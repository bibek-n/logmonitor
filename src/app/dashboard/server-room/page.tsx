import { getServerRoomAccess } from "@/lib/requireServerRoomPermission";
import { ServerRoomDashboardClient } from "@/components/serverRoom/ServerRoomDashboardClient";

export const dynamic = "force-dynamic";

export default async function ServerRoomDashboardPage() {
  const { sr } = await getServerRoomAccess();
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
        <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Server Room Dashboard</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>
          Server room visits, technical / hosting / security tasks, open incidents and the current state of updates.
        </p>
      </div>
      <ServerRoomDashboardClient />
    </div>
  );
}
