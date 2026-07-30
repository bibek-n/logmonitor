import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { SshKeysClient } from "@/components/remoteAccess/SshKeysClient";

export const dynamic = "force-dynamic";

export default async function SshKeysPage() {
  const ra = await getRemoteAccessSession("ra_ssh_keys_manage");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>SSH Keys</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to SSH Key management.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>SSH Keys</h1>
      <SshKeysClient />
    </div>
  );
}
