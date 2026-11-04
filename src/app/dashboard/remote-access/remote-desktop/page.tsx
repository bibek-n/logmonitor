import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { RemoteDesktopLandingClient } from "@/components/remoteAccess/RemoteDesktopLandingClient";

export const dynamic = "force-dynamic";

export default async function RemoteDesktopPage() {
  const ra = await getRemoteAccessSession("ra_view");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Remote Desktop</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Remote Access.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Remote Desktop</h1>
      <RemoteDesktopLandingClient />
    </div>
  );
}
