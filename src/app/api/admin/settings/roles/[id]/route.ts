import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const roleId = Number(id);
  if (!Number.isInteger(roleId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const role = await db.request().input("id", sql.Int, roleId).query<{ IsSystem: boolean; Name: string }>("SELECT IsSystem, Name FROM Roles WHERE Id = @id");
  if (role.recordset[0]?.IsSystem) {
    return NextResponse.json({ ok: false, error: "Built-in roles cannot be deleted." }, { status: 400 });
  }

  try {
    await db.request().input("id", sql.Int, roleId).query("DELETE FROM RolePermissions WHERE RoleId = @id");
    await db.request().input("id", sql.Int, roleId).query("DELETE FROM Roles WHERE Id = @id");
  } catch {
    return NextResponse.json({ ok: false, error: "Cannot delete: this role is still referenced elsewhere." }, { status: 409 });
  }

  await logAdminAction({ admin, section: "users_access", action: "delete_role", details: role.recordset[0]?.Name ?? String(roleId), req });

  return NextResponse.json({ ok: true });
}
