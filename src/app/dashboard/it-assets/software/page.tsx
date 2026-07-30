import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { SoftwareInventoryClient } from "@/components/itAssetLogsheet/SoftwareInventoryClient";

export const dynamic = "force-dynamic";

export default async function SoftwareInventoryPage() {
  const ita = await getItAssetSession("ita_view");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Software Inventory</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view software inventory.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Software Inventory</h1>
      <SoftwareInventoryClient />
    </div>
  );
}
