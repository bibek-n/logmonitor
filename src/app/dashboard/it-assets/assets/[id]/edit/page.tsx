import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { AssetFormClient } from "@/components/itAssetLogsheet/AssetFormClient";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const ita = await getItAssetSession("ita_asset_edit");
  const { id } = await params;
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Edit Asset</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to edit assets.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Edit Asset</h1>
      <AssetFormClient assetId={Number(id)} />
    </div>
  );
}
