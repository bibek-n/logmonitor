import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { TerminalWorkspaceClient } from "@/components/remoteAccess/TerminalWorkspaceClient";

export const dynamic = "force-dynamic";

export default async function TerminalSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const ra = await getRemoteAccessSession("ra_ssh_start");
  const { sessionId } = await params;
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Terminal</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to use the Terminal.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Terminal</h1>
      <TerminalWorkspaceClient sessionId={Number(sessionId)} />
    </div>
  );
}
