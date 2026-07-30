import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { CredentialsVaultClient } from "@/components/remoteAccess/CredentialsVaultClient";

export const dynamic = "force-dynamic";

export default async function CredentialsPage() {
  const ra = await getRemoteAccessSession("ra_credentials_use");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Credentials Vault</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to the Credentials Vault.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Credentials Vault</h1>
      <CredentialsVaultClient />
    </div>
  );
}
