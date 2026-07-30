import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { AssetFormClient } from "@/components/itAssetLogsheet/AssetFormClient";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const ita = await getItAssetSession("ita_asset_create");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Add Asset</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to create assets.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Add Asset</h1>
      <AssetFormClient />
    </div>
  );
}
