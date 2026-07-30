import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { ContainersClient } from "@/components/remoteAccess/ContainersClient";

export const dynamic = "force-dynamic";

export default async function ConnectionContainersPage({ params }: { params: Promise<{ id: string }> }) {
  const ra = await getRemoteAccessSession("ra_commands_execute");
  const { id } = await params;
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Containers</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to run commands on connections.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Docker / Kubernetes Containers</h1>
      <ContainersClient connectionId={Number(id)} />
    </div>
  );
}
