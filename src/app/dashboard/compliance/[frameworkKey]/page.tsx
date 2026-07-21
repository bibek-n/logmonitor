import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/requireAdmin";
import { getDb, sql } from "@/lib/db";
import { ComplianceControlsTable } from "@/components/compliance/ComplianceControlsTable";

export const dynamic = "force-dynamic";

export default async function ComplianceFrameworkPage({ params }: { params: Promise<{ frameworkKey: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Compliance</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view this page.</p>
      </div>
    );
  }

  const { frameworkKey } = await params;
  const db = await getDb();

  const frameworkResult = await db
    .request()
    .input("key", sql.VarChar, frameworkKey)
    .query<{ Id: number; Key: string; Name: string; Description: string | null }>("SELECT Id, [Key], Name, Description FROM ComplianceFrameworks WHERE [Key] = @key");
  const framework = frameworkResult.recordset[0];
  if (!framework) notFound();

  const controlsResult = await db.request().input("frameworkId", sql.Int, framework.Id).query(`
    SELECT Id, ControlCode, Category, Title, Description, AutoCheckKey, Status, Evidence, Notes,
      CONVERT(VARCHAR(19), ReviewedAt, 126) AS ReviewedAt, AutoCheckStatus, AutoCheckDetail,
      CONVERT(VARCHAR(19), AutoCheckedAt, 126) AS AutoCheckedAt
    FROM ComplianceControls WHERE FrameworkId = @frameworkId ORDER BY SortOrder ASC
  `);

  return (
    <div>
      <p style={{ marginBottom: "0.25rem" }}>
        <Link href="/dashboard/compliance" style={{ color: "var(--primary)", fontSize: "0.85rem" }}>
          &larr; Back to Compliance
        </Link>
      </p>
      <h1 style={{ fontSize: "1.4rem", margin: 0, marginBottom: "0.25rem" }}>{framework.Name}</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.25rem" }}>{framework.Description}</p>

      <ComplianceControlsTable controls={controlsResult.recordset} />
    </div>
  );
}
