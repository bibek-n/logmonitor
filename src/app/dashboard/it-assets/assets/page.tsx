import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { AssetRegisterClient } from "@/components/itAssetLogsheet/AssetRegisterClient";

export const dynamic = "force-dynamic";

export default async function AssetRegisterPage() {
  const ita = await getItAssetSession("ita_view");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Asset Register</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view the Asset Register.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Asset Register</h1>
      <AssetRegisterClient />
    </div>
  );
}
