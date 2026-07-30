import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { ScriptsClient } from "@/components/remoteAccess/ScriptsClient";

export const dynamic = "force-dynamic";

export default async function ScriptsAndCommandsPage() {
  const ra = await getRemoteAccessSession("ra_scripts_execute");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Scripts &amp; Commands</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Scripts &amp; Commands.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Scripts &amp; Commands</h1>
      <ScriptsClient />
    </div>
  );
}
