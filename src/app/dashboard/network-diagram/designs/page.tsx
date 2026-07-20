import { getAdminSession } from "@/lib/requireAdmin";
import { getDb } from "@/lib/db";
import { DesignsListClient, type DesignSummary } from "@/components/networkDiagramDesigner/DesignsListClient";

export const dynamic = "force-dynamic";

export default async function NetworkDiagramDesignsPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Network Diagrams</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view network diagrams.</p>
      </div>
    );
  }

  const db = await getDb();

  const legacyResult = await db.query<{ Name: string; DiagramJson: string | null; UpdatedAt: string }>(
    "SELECT Name, DiagramJson, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt FROM NetworkDiagrams WHERE Id = 1"
  );
  const legacyRow = legacyResult.recordset[0];
  const legacy = {
    name: legacyRow?.Name ?? "Enterprise Network Topology",
    updatedAt: legacyRow?.DiagramJson ? legacyRow.UpdatedAt : null,
    hasContent: Boolean(legacyRow?.DiagramJson),
  };

  const designsResult = await db.query<DesignSummary>(`
    SELECT Id, Name, Description, Status, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM NetworkDiagramDesigns
    WHERE DeletedAt IS NULL
    ORDER BY UpdatedAt DESC
  `);

  return <DesignsListClient legacy={legacy} designs={designsResult.recordset} />;
}
