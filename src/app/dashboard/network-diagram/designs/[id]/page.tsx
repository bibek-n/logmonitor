import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/requireAdmin";
import { getDb, sql } from "@/lib/db";
import { normalizeDiagramData } from "@/lib/networkDiagramDesigner/normalizer";
import { DiagramEditor } from "@/components/networkDiagramDesigner/DiagramEditor";
import type { NetworkDiagramDesignStatus } from "@/lib/networkDiagramDesigner/types";

export const dynamic = "force-dynamic";

interface DesignRow {
  Id: number;
  Name: string;
  Description: string | null;
  DiagramJson: string;
  Status: NetworkDiagramDesignStatus;
  DeletedAt: string | null;
}

export default async function ViewNetworkDiagramDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Network Diagram</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view network diagrams.</p>
      </div>
    );
  }

  const { id } = await params;
  const designId = Number(id);
  if (!Number.isInteger(designId)) notFound();

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, designId)
    .query<DesignRow>("SELECT Id, Name, Description, DiagramJson, Status, DeletedAt FROM NetworkDiagramDesigns WHERE Id = @id");
  const row = result.recordset[0];
  if (!row || row.DeletedAt) notFound();

  const diagramData = normalizeDiagramData(JSON.parse(row.DiagramJson));

  return (
    <DiagramEditor
      mode="view"
      initial={{ id: row.Id, name: row.Name, description: row.Description, status: row.Status, diagramData }}
    />
  );
}
