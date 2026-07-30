import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { DashboardClient } from "@/components/itAssetLogsheet/DashboardClient";

export const dynamic = "force-dynamic";

export default async function ItAssetDashboardPage() {
  const ita = await getItAssetSession("ita_view");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>IT Asset Logsheet</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view the IT Asset Logsheet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>IT Asset Logsheet</h1>
      <DashboardClient />
    </div>
  );
}
