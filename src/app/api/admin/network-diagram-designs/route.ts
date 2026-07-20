import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { createDesignSchema } from "@/lib/networkDiagramDesigner/schema";

// New, independent CRUD surface for the "Design New Diagram" designer — entirely separate
// from /api/admin/network-diagram (the legacy single-diagram GET/PUT). Nothing here reads or
// writes the legacy NetworkDiagrams table.

interface DesignSummaryRow {
  Id: number;
  Name: string;
  Description: string | null;
  Status: string;
  OwnerUserId: number;
  CreatedAt: string;
  UpdatedAt: string;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<DesignSummaryRow>`
    SELECT Id, Name, Description, Status, OwnerUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM NetworkDiagramDesigns
    WHERE DeletedAt IS NULL
    ORDER BY UpdatedAt DESC
  `;

  return NextResponse.json({ ok: true, data: result.recordset });
}

// Always inserts a new row — this endpoint never updates an existing diagram. Updating an
// existing design is PUT /api/admin/network-diagram-designs/[id].
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const parsed = createDesignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }
  const { name, description, status, diagramData } = parsed.data;

  const db = await getDb();
  const insertResult = await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, description || null)
    .input("diagramJson", sql.NVarChar, JSON.stringify(diagramData))
    .input("status", sql.VarChar, status ?? "Draft")
    .input("ownerUserId", sql.Int, admin.userId)
    .input("createdByUserId", sql.Int, admin.userId)
    .query<{ Id: number; Name: string; Description: string | null; Status: string; CreatedAt: string; UpdatedAt: string }>(`
      INSERT INTO NetworkDiagramDesigns (Name, Description, DiagramJson, Status, OwnerUserId, CreatedByUserId)
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Description, INSERTED.Status,
        CONVERT(VARCHAR(19), INSERTED.CreatedAt, 126) AS CreatedAt,
        CONVERT(VARCHAR(19), INSERTED.UpdatedAt, 126) AS UpdatedAt
      VALUES (@name, @description, @diagramJson, @status, @ownerUserId, @createdByUserId)
    `);
  const design = insertResult.recordset[0];

  await logAdminAction({
    admin,
    section: "network_diagram_designs",
    action: "create_design",
    details: `${design.Name} (${diagramData.nodes.length} nodes, ${diagramData.edges.length} edges)`,
    req,
  });

  return NextResponse.json({ ok: true, data: design });
}
