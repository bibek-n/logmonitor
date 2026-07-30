import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { PatchesClient } from "@/components/itAssetLogsheet/PatchesClient";

export const dynamic = "force-dynamic";

export default async function PatchesPage() {
  const ita = await getItAssetSession("ita_view");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Patches and Updates</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view patch records.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Patches and Updates</h1>
      <PatchesClient />
    </div>
  );
}
