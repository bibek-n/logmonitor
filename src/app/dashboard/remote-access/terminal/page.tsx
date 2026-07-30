import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { TerminalLandingClient } from "@/components/remoteAccess/TerminalLandingClient";

export const dynamic = "force-dynamic";

export default async function TerminalLandingPage() {
  const ra = await getRemoteAccessSession("ra_ssh_start");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Terminal</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to start SSH sessions.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Terminal</h1>
      <TerminalLandingClient />
    </div>
  );
}
