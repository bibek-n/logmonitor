import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { DEFAULT_DIAGRAM, validateDiagram, type DiagramDoc } from "@/lib/networkDiagram";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<{ DiagramJson: string | null }>`SELECT DiagramJson FROM NetworkDiagrams WHERE Id = 1`;
  const raw = result.recordset[0]?.DiagramJson;
  const diagram: DiagramDoc = raw ? JSON.parse(raw) : DEFAULT_DIAGRAM;

  return NextResponse.json({ ok: true, diagram });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body || !validateDiagram(body.diagram)) {
    return NextResponse.json({ ok: false, error: "Invalid diagram payload" }, { status: 400 });
  }
  const diagram = body.diagram as DiagramDoc;

  const db = await getDb();
  await db
    .request()
    .input("name", sql.NVarChar, diagram.title.slice(0, 200))
    .input("diagramJson", sql.NVarChar, JSON.stringify(diagram))
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE NetworkDiagrams SET Name = @name, DiagramJson = @diagramJson, UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1;
      IF @@ROWCOUNT = 0
        INSERT INTO NetworkDiagrams (Id, Name, DiagramJson, UpdatedByUserId) VALUES (1, @name, @diagramJson, @updatedByUserId);
    `);

  await logAdminAction({
    admin,
    section: "network_diagram",
    action: "update_diagram",
    details: `${diagram.nodes.length} nodes, ${diagram.edges.length} edges, ${diagram.zones.length} zones`,
    req,
  });

  return NextResponse.json({ ok: true });
}
