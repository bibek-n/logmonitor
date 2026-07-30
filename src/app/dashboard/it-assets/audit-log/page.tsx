import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { ComingSoon } from "@/components/itAssetLogsheet/ComingSoon";

export const dynamic = "force-dynamic";

export default async function ItAssetAuditLogPage() {
  const ita = await getItAssetSession("ita_audit_view");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Audit Log</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view the audit log.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Audit Log</h1>
      <ComingSoon feature="A dedicated, filterable audit history view (create/update/delete/import/export/approval actions)" />
    </div>
  );
}
