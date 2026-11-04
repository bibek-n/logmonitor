import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { buildMenuKeyTree, type MenuKeyNode } from "@/lib/navRoutes";
import { getAllMenuKeys } from "@/lib/roleMenuAccess";

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
    .query<{ MenuKey: string; Allowed: boolean }>("SELECT MenuKey, Allowed FROM RoleMenuAccess WHERE RoleId = @roleId");

  // Until this role has been customized at least once, every key defaults to allowed=true
  // (full visibility — identical to pre-feature behavior). Once customized, a key with no row
  // is treated as hidden (the PATCH route below always writes the complete key set).
  const customized = result.recordset.length > 0;
  const allowedMap = new Map(result.recordset.map((r) => [r.MenuKey, r.Allowed]));

  function annotate(nodes: MenuKeyNode[]): (MenuKeyNode & { allowed: boolean })[] {
    return nodes.map((node) => ({
      ...node,
      allowed: customized ? allowedMap.get(node.key) === true : true,
      children: node.children ? annotate(node.children) : undefined,
    }));
  }

  return NextResponse.json({ ok: true, tree: annotate(buildMenuKeyTree()) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const roleId = Number(id);
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(roleId) || !Array.isArray(body?.menuAccess)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const validKeys = new Set(getAllMenuKeys());
  const db = await getDb();
  await db.request().input("roleId", sql.Int, roleId).query("DELETE FROM RoleMenuAccess WHERE RoleId = @roleId");

  for (const entry of body.menuAccess as { key: string; allowed: boolean }[]) {
    if (!validKeys.has(entry.key)) continue;
    await db
      .request()
      .input("roleId", sql.Int, roleId)
      .input("menuKey", sql.NVarChar, entry.key)
      .input("allowed", sql.Bit, !!entry.allowed)
      .query("INSERT INTO RoleMenuAccess (RoleId, MenuKey, Allowed) VALUES (@roleId, @menuKey, @allowed)");
  }

  await logAdminAction({ admin, section: "users_access", action: "update_role_menu_access", details: `roleId=${roleId}`, req });

  return NextResponse.json({ ok: true });
}
