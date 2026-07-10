import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { PERMISSION_KEYS } from "@/lib/permissionKeys";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const roleId = Number(id);
  if (!Number.isInteger(roleId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const result = await db
    .request()
    .input("roleId", sql.Int, roleId)
    .query<{ PermissionKey: string; Allowed: boolean }>("SELECT PermissionKey, Allowed FROM RolePermissions WHERE RoleId = @roleId");

  const allowedMap = new Map(result.recordset.map((r) => [r.PermissionKey, r.Allowed]));
  const data = PERMISSION_KEYS.map((key) => ({ key, allowed: allowedMap.get(key) ?? false }));

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const roleId = Number(id);
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(roleId) || !Array.isArray(body?.permissions)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  await db.request().input("roleId", sql.Int, roleId).query("DELETE FROM RolePermissions WHERE RoleId = @roleId");

  for (const perm of body.permissions as { key: string; allowed: boolean }[]) {
    if (!PERMISSION_KEYS.includes(perm.key)) continue;
    await db
      .request()
      .input("roleId", sql.Int, roleId)
      .input("permissionKey", sql.NVarChar, perm.key)
      .input("allowed", sql.Bit, !!perm.allowed)
      .query("INSERT INTO RolePermissions (RoleId, PermissionKey, Allowed) VALUES (@roleId, @permissionKey, @allowed)");
  }

  await logAdminAction({ admin, section: "users_access", action: "update_role_permissions", details: `roleId=${roleId}`, req });

  return NextResponse.json({ ok: true });
}
