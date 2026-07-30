import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { PortForwardingClient } from "@/components/remoteAccess/PortForwardingClient";

export const dynamic = "force-dynamic";

export default async function PortForwardingPage() {
  const ra = await getRemoteAccessSession("ra_port_forwarding_manage");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Port Forwarding</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Port Forwarding.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Port Forwarding</h1>
      <PortForwardingClient />
    </div>
  );
}
