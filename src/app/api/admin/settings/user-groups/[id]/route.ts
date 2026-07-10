import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const groupId = Number(id);
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!Number.isInteger(groupId) || !name) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, groupId)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, typeof body?.description === "string" ? body.description.trim() || null : null)
    .query("UPDATE UserGroups SET Name = @name, Description = @description, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin, section: "users_access", action: "update_user_group", details: name, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isInteger(groupId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  await db.request().input("id", sql.Int, groupId).query("DELETE FROM UserGroupMembers WHERE GroupId = @id");
  await db.request().input("id", sql.Int, groupId).query("DELETE FROM UserGroups WHERE Id = @id");

  await logAdminAction({ admin, section: "users_access", action: "delete_user_group", details: String(groupId), req });

  return NextResponse.json({ ok: true });
}
