import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { QuickConnectClient } from "@/components/remoteAccess/QuickConnectClient";

export const dynamic = "force-dynamic";

export default async function QuickConnectPage() {
  const ra = await getRemoteAccessSession("ra_ssh_start");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Quick Connect</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to start sessions.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Quick Connect</h1>
      <QuickConnectClient />
    </div>
  );
}
