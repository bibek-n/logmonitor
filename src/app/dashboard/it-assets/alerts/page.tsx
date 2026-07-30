import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { ComingSoon } from "@/components/itAssetLogsheet/ComingSoon";

export const dynamic = "force-dynamic";

export default async function ItAssetAlertsPage() {
  const ita = await getItAssetSession("ita_view");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Alerts</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view alerts.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Alerts</h1>
      <ComingSoon feature="In-app and email alerting (password/patch/maintenance due dates, warranty and licence expiry, escalation rules)" />
    </div>
  );
}
