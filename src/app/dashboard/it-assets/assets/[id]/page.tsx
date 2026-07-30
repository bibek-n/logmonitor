import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { AssetDetailClient } from "@/components/itAssetLogsheet/AssetDetailClient";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ita = await getItAssetSession("ita_view");
  const { id } = await params;
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Asset Detail</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view this asset.</p>
      </div>
    );
  }

  return <AssetDetailClient assetId={Number(id)} />;
}
