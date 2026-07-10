import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const desigId = Number(id);
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!Number.isInteger(desigId) || !title) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, desigId)
    .input("title", sql.NVarChar, title)
    .input("description", sql.NVarChar, typeof body?.description === "string" ? body.description.trim() || null : null)
    .query("UPDATE JobDesignations SET Title = @title, Description = @description, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin, section: "organization", action: "update_job_designation", details: title, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const desigId = Number(id);
  if (!Number.isInteger(desigId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  try {
    await db.request().input("id", sql.Int, desigId).query("DELETE FROM JobDesignations WHERE Id = @id");
  } catch {
    return NextResponse.json({ ok: false, error: "Cannot delete: this job designation is still referenced elsewhere." }, { status: 409 });
  }

  await logAdminAction({ admin, section: "organization", action: "delete_job_designation", details: String(desigId), req });

  return NextResponse.json({ ok: true });
}
