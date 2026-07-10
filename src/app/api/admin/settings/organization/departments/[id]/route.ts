import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const deptId = Number(id);
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!Number.isInteger(deptId) || !name) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, deptId)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, typeof body?.description === "string" ? body.description.trim() || null : null)
    .query("UPDATE Departments SET Name = @name, Description = @description, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin, section: "organization", action: "update_department", details: name, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const deptId = Number(id);
  if (!Number.isInteger(deptId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  try {
    await db.request().input("id", sql.Int, deptId).query("DELETE FROM Departments WHERE Id = @id");
  } catch {
    return NextResponse.json({ ok: false, error: "Cannot delete: this department is still referenced by a team or employee." }, { status: 409 });
  }

  await logAdminAction({ admin, section: "organization", action: "delete_department", details: String(deptId), req });

  return NextResponse.json({ ok: true });
}
