import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { ConnectionFormClient } from "@/components/remoteAccess/ConnectionFormClient";

export const dynamic = "force-dynamic";

export default async function NewConnectionPage() {
  const ra = await getRemoteAccessSession("ra_connections_create");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>New Connection</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to create Connections.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>New Connection</h1>
      <ConnectionFormClient />
    </div>
  );
}
