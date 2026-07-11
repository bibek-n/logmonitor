import { getAdminSession } from "@/lib/requireAdmin";
import { getDb } from "@/lib/db";
import { DEFAULT_DIAGRAM, type DiagramDoc } from "@/lib/networkDiagram";
import { NetworkDiagramEditor } from "@/components/networkDiagram/NetworkDiagramEditor";

export const dynamic = "force-dynamic";

export default async function NetworkDiagramPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Network Diagram</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view the network diagram.</p>
      </div>
    );
  }

  const db = await getDb();
  const result = await db.query<{ DiagramJson: string | null }>("SELECT DiagramJson FROM NetworkDiagrams WHERE Id = 1");
  const raw = result.recordset[0]?.DiagramJson;
  const diagram: DiagramDoc = raw ? JSON.parse(raw) : DEFAULT_DIAGRAM;

  return <NetworkDiagramEditor initialDiagram={diagram} />;
}
