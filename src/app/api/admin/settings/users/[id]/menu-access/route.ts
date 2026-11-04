import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { buildMenuKeyTree, type MenuKeyNode } from "@/lib/navRoutes";
import { getAllMenuKeys, getRoleMenuAccessMap } from "@/lib/roleMenuAccess";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const userRow = await db.request().input("id", sql.Int, userId).query<{ Role: string }>("SELECT Role FROM Users WHERE Id = @id");
  const role = userRow.recordset[0]?.Role;
  if (!role) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const result = await db
    .request()
    .input("userId", sql.Int, userId)
    .query<{ MenuKey: string; Allowed: boolean }>("SELECT MenuKey, Allowed FROM UserMenuAccess WHERE UserId = @userId");

  // Shows the EFFECTIVE state (this user's own override if they have one, else what their
  // role currently allows) - same "customized once -> every key explicit" convention as the
  // role-level editor, just inheriting from the role as the starting point instead of a flat
  // all-true default.
  const customized = result.recordset.length > 0;
  const userAllowedMap = new Map(result.recordset.map((r) => [r.MenuKey, r.Allowed]));
  const roleMap = role === "Admin" ? null : await getRoleMenuAccessMap(role);

  function annotate(nodes: MenuKeyNode[]): (MenuKeyNode & { allowed: boolean })[] {
    return nodes.map((node) => ({
      ...node,
      allowed: customized ? userAllowedMap.get(node.key) === true : roleMap ? roleMap[node.key] !== false : true,
      children: node.children ? annotate(node.children) : undefined,
    }));
  }

  return NextResponse.json({ ok: true, role, tree: annotate(buildMenuKeyTree()) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const userId = Number(id);
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(userId) || !Array.isArray(body?.menuAccess)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const validKeys = new Set(getAllMenuKeys());
  const db = await getDb();
  await db.request().input("userId", sql.Int, userId).query("DELETE FROM UserMenuAccess WHERE UserId = @userId");

  for (const entry of body.menuAccess as { key: string; allowed: boolean }[]) {
    if (!validKeys.has(entry.key)) continue;
    await db
      .request()
      .input("userId", sql.Int, userId)
      .input("menuKey", sql.NVarChar, entry.key)
      .input("allowed", sql.Bit, !!entry.allowed)
      .query("INSERT INTO UserMenuAccess (UserId, MenuKey, Allowed) VALUES (@userId, @menuKey, @allowed)");
  }

  await logAdminAction({ admin, section: "users_access", action: "update_user_menu_access", details: `userId=${userId}`, req });

  return NextResponse.json({ ok: true });
}
