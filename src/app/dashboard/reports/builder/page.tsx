import { getAdminSession } from "@/lib/requireAdmin";
import { REPORT_SOURCES } from "@/lib/reportBuilder";
import { ReportBuilderClient } from "@/components/reports/ReportBuilderClient";

export const dynamic = "force-dynamic";

export default async function ReportBuilderPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Report Builder</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view this page.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Report Builder</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Pick a data source and the columns you care about, run it, export to CSV, or save the combination as a named template to reuse later.
      </p>
      <ReportBuilderClient sources={REPORT_SOURCES} />
    </div>
  );
}
