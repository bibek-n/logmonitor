import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { ConnectionFormClient } from "@/components/remoteAccess/ConnectionFormClient";

export const dynamic = "force-dynamic";

export default async function EditConnectionPage({ params }: { params: Promise<{ id: string }> }) {
  const ra = await getRemoteAccessSession("ra_connections_edit");
  const { id } = await params;
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Edit Connection</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to edit Connections.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Edit Connection</h1>
      <ConnectionFormClient connectionId={Number(id)} />
    </div>
  );
}
