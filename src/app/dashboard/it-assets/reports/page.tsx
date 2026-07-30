import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { ComingSoon } from "@/components/itAssetLogsheet/ComingSoon";

export const dynamic = "force-dynamic";

export default async function ItAssetReportsPage() {
  const ita = await getItAssetSession("ita_reports_view");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Reports</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view reports.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Reports</h1>
      <ComingSoon feature="The 15 audit-ready report types (asset inventory, password/patch compliance, licence expiry, technician activity, and more)" />
    </div>
  );
}
