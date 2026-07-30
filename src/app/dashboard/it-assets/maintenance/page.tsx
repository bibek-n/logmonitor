import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { MaintenanceLogClient } from "@/components/itAssetLogsheet/MaintenanceLogClient";

export const dynamic = "force-dynamic";

export default async function MaintenanceLogPage() {
  const ita = await getItAssetSession("ita_view");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Maintenance Log</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view maintenance records.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Maintenance Log</h1>
      <MaintenanceLogClient />
    </div>
  );
}
