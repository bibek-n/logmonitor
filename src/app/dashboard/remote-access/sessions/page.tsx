import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { ActiveSessionsClient } from "@/components/remoteAccess/ActiveSessionsClient";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const ra = await getRemoteAccessSession("ra_view");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Active Sessions</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view sessions.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Active Sessions</h1>
      <ActiveSessionsClient />
    </div>
  );
}
