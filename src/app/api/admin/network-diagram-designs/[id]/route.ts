import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { updateDesignSchema } from "@/lib/networkDiagramDesigner/schema";
import { normalizeDiagramData } from "@/lib/networkDiagramDesigner/normalizer";

interface DesignRow {
  Id: number;
  Name: string;
  Description: string | null;
  DiagramJson: string;
  Status: string;
  OwnerUserId: number;
  CreatedByUserId: number;
  UpdatedByUserId: number | null;
  CreatedAt: string;
  UpdatedAt: string;
  DeletedAt: string | null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const designId = Number(id);
  if (!Number.isInteger(designId)) {
    return NextResponse.json({ ok: false, error: "Invalid design id." }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, designId).query<DesignRow>(`
    SELECT Id, Name, Description, DiagramJson, Status, OwnerUserId, CreatedByUserId, UpdatedByUserId,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt,
      DeletedAt
    FROM NetworkDiagramDesigns WHERE Id = @id
  `);
  const row = result.recordset[0];
  if (!row || row.DeletedAt) {
    return NextResponse.json({ ok: false, error: "Diagram not found." }, { status: 404 });
  }

  const diagramData = normalizeDiagramData(JSON.parse(row.DiagramJson));

  return NextResponse.json({
    ok: true,
    data: {
      Id: row.Id, Name: row.Name, Description: row.Description, Status: row.Status,
      OwnerUserId: row.OwnerUserId, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
      diagramData,
    },
  });
}

// Updates an existing row only — this never creates a new record (that's POST
// /api/admin/network-diagram-designs). 404s if the id doesn't exist or was soft-deleted, so a
// stale/guessed id can't silently resurrect or overwrite an unrelated row.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const designId = Number(id);
  if (!Number.isInteger(designId)) {
    return NextResponse.json({ ok: false, error: "Invalid design id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateDesignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const db = await getDb();
  const existingResult = await db.request().input("id", sql.Int, designId).query<{ Name: string; DeletedAt: string | null }>(
    "SELECT Name, DeletedAt FROM NetworkDiagramDesigns WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing || existing.DeletedAt) {
    return NextResponse.json({ ok: false, error: "Diagram not found." }, { status: 404 });
  }

  const { name, description, status, diagramData } = parsed.data;
  const updateRequest = db.request().input("id", sql.Int, designId).input("updatedByUserId", sql.Int, admin.userId);
  const setClauses = ["UpdatedAt = SYSUTCDATETIME()", "UpdatedByUserId = @updatedByUserId"];

  if (name !== undefined) {
    updateRequest.input("name", sql.NVarChar, name);
    setClauses.push("Name = @name");
  }
  if (description !== undefined) {
    updateRequest.input("description", sql.NVarChar, description || null);
    setClauses.push("Description = @description");
  }
  if (status !== undefined) {
    updateRequest.input("status", sql.VarChar, status);
    setClauses.push("Status = @status");
  }
  if (diagramData !== undefined) {
    updateRequest.input("diagramJson", sql.NVarChar, JSON.stringify(diagramData));
    setClauses.push("DiagramJson = @diagramJson");
  }

  await updateRequest.query(`UPDATE NetworkDiagramDesigns SET ${setClauses.join(", ")} WHERE Id = @id`);

  await logAdminAction({
    admin,
    section: "network_diagram_designs",
    action: "update_design",
    details: name ?? existing.Name,
    req,
  });

  return NextResponse.json({ ok: true });
}

// Soft delete — matches this app's no-hard-delete convention (e.g. QA test-case archiving).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const designId = Number(id);
  if (!Number.isInteger(designId)) {
    return NextResponse.json({ ok: false, error: "Invalid design id." }, { status: 400 });
  }

  const db = await getDb();
  const existingResult = await db.request().input("id", sql.Int, designId).query<{ Name: string; DeletedAt: string | null }>(
    "SELECT Name, DeletedAt FROM NetworkDiagramDesigns WHERE Id = @id"
  );
  const existing = existingResult.recordset[0];
  if (!existing || existing.DeletedAt) {
    return NextResponse.json({ ok: false, error: "Diagram not found." }, { status: 404 });
  }

  await db.request().input("id", sql.Int, designId).query("UPDATE NetworkDiagramDesigns SET DeletedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin, section: "network_diagram_designs", action: "delete_design", details: existing.Name, req });

  return NextResponse.json({ ok: true });
}
