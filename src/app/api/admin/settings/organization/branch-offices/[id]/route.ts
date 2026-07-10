import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const officeId = Number(id);
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!Number.isInteger(officeId) || !name) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, officeId)
    .input("name", sql.NVarChar, name)
    .input("address", sql.NVarChar, str(body?.address))
    .input("city", sql.NVarChar, str(body?.city))
    .input("country", sql.NVarChar, str(body?.country))
    .input("phone", sql.NVarChar, str(body?.phone))
    .query("UPDATE BranchOffices SET Name = @name, Address = @address, City = @city, Country = @country, Phone = @phone, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin, section: "organization", action: "update_branch_office", details: name, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const officeId = Number(id);
  if (!Number.isInteger(officeId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  try {
    await db.request().input("id", sql.Int, officeId).query("DELETE FROM BranchOffices WHERE Id = @id");
  } catch {
    return NextResponse.json({ ok: false, error: "Cannot delete: this branch office is still referenced elsewhere." }, { status: 409 });
  }

  await logAdminAction({ admin, section: "organization", action: "delete_branch_office", details: String(officeId), req });

  return NextResponse.json({ ok: true });
}
