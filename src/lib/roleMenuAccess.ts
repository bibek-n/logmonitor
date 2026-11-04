import { getDb, sql } from "./db";
import { buildMenuKeyTree, type MenuKeyNode } from "./navRoutes";

export function getAllMenuKeys(): string[] {
  const keys: string[] = [];
  function walk(nodes: MenuKeyNode[]) {
    for (const node of nodes) {
      keys.push(node.key);
      if (node.children) walk(node.children);
    }
  }
  walk(buildMenuKeyTree());
  return keys;
}

// null = no restriction (Admin, or this role has never had its menu customized — full
// default visibility, same as before this feature existed). A role only gets an entry here
// once an admin saves its Menu Access settings at least once; from then on every key is
// explicit (missing key = hidden), since the PATCH route always writes the full key set.
export async function getRoleMenuAccessMap(role: string): Promise<Record<string, boolean> | null> {
  if (role === "Admin") return null;

  const db = await getDb();
  const result = await db
    .request()
    .input("role", sql.NVarChar, role)
    .query<{ MenuKey: string; Allowed: boolean }>(
      "SELECT rma.MenuKey, rma.Allowed FROM RoleMenuAccess rma JOIN Roles r ON r.Id = rma.RoleId WHERE r.Name = @role"
    );
  if (result.recordset.length === 0) return null;
  return Object.fromEntries(result.recordset.map((r) => [r.MenuKey, r.Allowed]));
}

// Per-user override on top of their role's menu (UserMenuAccess) - lets an admin give one
// person their own individually-configured sidebar without needing a dedicated role just for
// them. null = this user has never had their own menu customized (fully inherits their role).
export async function getUserMenuAccessMap(userId: number): Promise<Record<string, boolean> | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("userId", sql.Int, userId)
    .query<{ MenuKey: string; Allowed: boolean }>("SELECT MenuKey, Allowed FROM UserMenuAccess WHERE UserId = @userId");
  if (result.recordset.length === 0) return null;
  return Object.fromEntries(result.recordset.map((r) => [r.MenuKey, r.Allowed]));
}

// Combines a role's menu map with a user's own override, the user's override winning key-by-
// key where both specify it. Admin never gets restricted here - callers are expected to pass
// null for both when the user's role is Admin (same bypass convention as every other
// permission check in this codebase).
export function mergeMenuAccess(
  roleMap: Record<string, boolean> | null,
  userMap: Record<string, boolean> | null
): Record<string, boolean> | null {
  if (!roleMap && !userMap) return null;
  return { ...(roleMap ?? {}), ...(userMap ?? {}) };
}
