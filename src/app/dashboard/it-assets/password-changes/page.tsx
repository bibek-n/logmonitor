import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { PasswordChangesClient } from "@/components/itAssetLogsheet/PasswordChangesClient";

export const dynamic = "force-dynamic";

export default async function PasswordChangesPage() {
  const ita = await getItAssetSession("ita_view");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Password Changes</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view password change records.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Password Changes</h1>
      <PasswordChangesClient />
    </div>
  );
}
