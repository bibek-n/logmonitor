import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { ConnectionsClient } from "@/components/remoteAccess/ConnectionsClient";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const ra = await getRemoteAccessSession("ra_connections_view");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Connections</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view Connections.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Connections</h1>
      <ConnectionsClient />
    </div>
  );
}
