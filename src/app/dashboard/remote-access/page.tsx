import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { RemoteAccessDashboardClient } from "@/components/remoteAccess/RemoteAccessDashboardClient";

export const dynamic = "force-dynamic";

export default async function RemoteAccessOverviewPage() {
  const ra = await getRemoteAccessSession("ra_view");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Remote Access</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view Remote Access.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Remote Access</h1>
      <RemoteAccessDashboardClient />
    </div>
  );
}
