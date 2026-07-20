import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface LsSession {
  userId: number;
  username: string;
  role: string;
}

// Laravel Security module's permission gate — follows the same PERMISSION_KEYS/RolePermissions
// mechanism as requireCodeQualityPermission.ts. Deliberately scoped to
// /api/admin/laravel-security/** only.
//
// Admin always passes regardless of RolePermissions — same superuser convention used
// everywhere else in this app.
async function resolveBaseSession(): Promise<{ userId: number; username: string; role: string } | null> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !role) return null;

  const username = session.user?.name ?? null;
  if (!username) return null;

  let userId: number | null = null;
  const sessionUserId = (session.user as { id?: string } | undefined)?.id;
  if (sessionUserId) {
    userId = Number(sessionUserId);
  } else {
    const db = await getDb();
    const userRow = await db
      .request()
      .input("username", sql.NVarChar, username)
      .query<{ Id: number }>("SELECT Id FROM Users WHERE Username = @username");
    userId = userRow.recordset[0]?.Id ?? null;
  }
  if (userId === null) return null;

  return { userId, username, role };
}

async function resolveLsSession(permissionKey: string): Promise<LsSession | null> {
  const base = await resolveBaseSession();
  if (!base) return null;
  if (base.role === "Admin") return base;

  const db = await getDb();
  const grant = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .input("key", sql.NVarChar, permissionKey)
    .query<{ Allowed: boolean }>(
      "SELECT rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role AND rp.PermissionKey = @key"
    );
  const allowed = grant.recordset[0]?.Allowed === true;
  return allowed ? base : null;
}

export const LS_PERMISSION_KEYS = [
  "ls_view",
  "ls_project_create",
  "ls_project_update",
  "ls_project_delete",
  "ls_scan_start",
  "ls_scan_cancel",
  "ls_issue_update",
  "ls_settings_manage",
  "ls_export",
] as const;

// For Server Component pages: one query resolving every ls_* grant for the caller's role at
// once, so a page needing to show/hide several buttons doesn't do a round trip per button.
// UI convenience only — every mutation route still independently re-checks via
// requireLaravelSecurityPermission(), so hiding a button here changes nothing about enforcement.
export async function getLsAccess(): Promise<{ ls: LsSession | null; can: Record<string, boolean> }> {
  const base = await resolveBaseSession();
  if (!base) return { ls: null, can: {} };

  if (base.role === "Admin") {
    return { ls: base, can: Object.fromEntries(LS_PERMISSION_KEYS.map((k) => [k, true])) };
  }

  const db = await getDb();
  const grants = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .query<{ PermissionKey: string; Allowed: boolean }>(
      "SELECT rp.PermissionKey, rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role"
    );

  const can: Record<string, boolean> = Object.fromEntries(LS_PERMISSION_KEYS.map((k) => [k, false]));
  for (const grant of grants.recordset) {
    if (grant.Allowed && grant.PermissionKey in can) can[grant.PermissionKey] = true;
  }

  return { ls: can.ls_view ? base : null, can };
}

export async function requireLaravelSecurityPermission(permissionKey: string): Promise<LsSession | NextResponse> {
  const ls = await resolveLsSession(permissionKey);
  if (!ls) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return ls;
}

export function isLsSession(value: LsSession | NextResponse): value is LsSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead of
// a 403 response so pages can render their own "not allowed" state.
export async function getLsSession(permissionKey: string): Promise<LsSession | null> {
  return resolveLsSession(permissionKey);
}
