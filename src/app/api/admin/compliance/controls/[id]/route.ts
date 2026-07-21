import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

const VALID_STATUSES = new Set(["not_started", "in_progress", "implemented", "not_applicable"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const controlId = Number(id);
  if (!Number.isInteger(controlId)) return NextResponse.json({ ok: false, error: "Invalid control id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });

  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, controlId)
    .query<{ Id: number; ControlCode: string; FrameworkId: number }>("SELECT Id, ControlCode, FrameworkId FROM ComplianceControls WHERE Id = @id");
  const control = existing.recordset[0];
  if (!control) return NextResponse.json({ ok: false, error: "Control not found." }, { status: 404 });

  const setClauses: string[] = [];
  const request = db.request().input("id", sql.Int, controlId);

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
    }
    request.input("status", sql.VarChar, body.status);
    setClauses.push("Status = @status");
  }
  if (body.evidence !== undefined) {
    request.input("evidence", sql.NVarChar, typeof body.evidence === "string" ? body.evidence.slice(0, 4000) : null);
    setClauses.push("Evidence = @evidence");
  }
  if (body.notes !== undefined) {
    request.input("notes", sql.NVarChar, typeof body.notes === "string" ? body.notes.slice(0, 4000) : null);
    setClauses.push("Notes = @notes");
  }
  if (body.markReviewed === true) {
    setClauses.push("ReviewedAt = SYSUTCDATETIME()");
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update." }, { status: 400 });
  }

  request.input("updatedByUserId", sql.Int, admin.userId);
  setClauses.push("UpdatedAt = SYSUTCDATETIME()", "UpdatedByUserId = @updatedByUserId");

  await request.query(`UPDATE ComplianceControls SET ${setClauses.join(", ")} WHERE Id = @id`);

  await logAdminAction({
    admin,
    section: "Compliance",
    action: "Updated control",
    details: `${control.ControlCode}${body.status ? ` -> ${body.status}` : ""}`,
    req,
  });

  return NextResponse.json({ ok: true });
}
