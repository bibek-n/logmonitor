import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface WebAccessControlSession {
  userId: number;
  username: string;
  role: string;
}

// Web Access Control module's permission gate — same PERMISSION_KEYS/RolePermissions
// mechanism as every other enforced module (see requireBrowserActivityPermission.ts, the
// template this copies). Deliberately scoped to /api/admin/web-access-control/** only.
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

async function resolveWebAccessControlSession(permissionKey: string): Promise<WebAccessControlSession | null> {
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

export const WEB_ACCESS_CONTROL_PERMISSION_KEYS = [
  "wac_view",
  "wac_staff_group_manage",
  "wac_rule_create",
  "wac_rule_edit",
  "wac_rule_delete",
  "wac_allowlist_manage",
  "wac_schedule_manage",
  "wac_settings_manage",
  "wac_sophos_sync_manage",
  "wac_audit_log_view",
] as const;

// For Server Component pages: one query resolving every wac_* grant for the caller's role
// at once, so a page needing to show/hide several buttons (e.g. rule edit/delete, sync)
// doesn't do a round trip per button. UI convenience only — every mutation/read route still
// independently re-checks via requireWebAccessControlPermission(), so hiding a button here
// changes nothing about enforcement.
export async function getWebAccessControlAccess(): Promise<{ webAccessControl: WebAccessControlSession | null; can: Record<string, boolean> }> {
  const base = await resolveBaseSession();
  if (!base) return { webAccessControl: null, can: {} };

  if (base.role === "Admin") {
    return { webAccessControl: base, can: Object.fromEntries(WEB_ACCESS_CONTROL_PERMISSION_KEYS.map((k) => [k, true])) };
  }

  const db = await getDb();
  const grants = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .query<{ PermissionKey: string; Allowed: boolean }>(
      "SELECT rp.PermissionKey, rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role"
    );

  const can: Record<string, boolean> = Object.fromEntries(WEB_ACCESS_CONTROL_PERMISSION_KEYS.map((k) => [k, false]));
  for (const grant of grants.recordset) {
    if (grant.Allowed && grant.PermissionKey in can) can[grant.PermissionKey] = true;
  }

  return { webAccessControl: can.wac_view ? base : null, can };
}

export async function requireWebAccessControlPermission(permissionKey: string): Promise<WebAccessControlSession | NextResponse> {
  const webAccessControl = await resolveWebAccessControlSession(permissionKey);
  if (!webAccessControl) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return webAccessControl;
}

export function isWebAccessControlSession(value: WebAccessControlSession | NextResponse): value is WebAccessControlSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead
// of a 403 response so pages can render their own "not allowed" state.
export async function getWebAccessControlSession(permissionKey: string): Promise<WebAccessControlSession | null> {
  return resolveWebAccessControlSession(permissionKey);
}
