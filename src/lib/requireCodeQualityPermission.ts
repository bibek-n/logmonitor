import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface CqSession {
  userId: number;
  username: string;
  role: string;
}

// Code Quality module's permission gate — follows the same PERMISSION_KEYS/RolePermissions
// mechanism QA Testing activated first (see requireQaPermission.ts). Deliberately scoped to
// /api/admin/code-quality/** only.
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

async function resolveCqSession(permissionKey: string): Promise<CqSession | null> {
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

export const CQ_PERMISSION_KEYS = [
  "cq_view",
  "cq_project_create",
  "cq_project_update",
  "cq_project_delete",
  "cq_scan_start",
  "cq_scan_cancel",
  "cq_issue_update",
  "cq_settings_manage",
  "cq_export",
] as const;

// For Server Component pages: one query resolving every cq_* grant for the caller's role at
// once, so a page needing to show/hide several buttons doesn't do a round trip per button.
// UI convenience only — every mutation route still independently re-checks via
// requireCodeQualityPermission(), so hiding a button here changes nothing about enforcement.
export async function getCqAccess(): Promise<{ cq: CqSession | null; can: Record<string, boolean> }> {
  const base = await resolveBaseSession();
  if (!base) return { cq: null, can: {} };

  if (base.role === "Admin") {
    return { cq: base, can: Object.fromEntries(CQ_PERMISSION_KEYS.map((k) => [k, true])) };
  }

  const db = await getDb();
  const grants = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .query<{ PermissionKey: string; Allowed: boolean }>(
      "SELECT rp.PermissionKey, rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role"
    );

  const can: Record<string, boolean> = Object.fromEntries(CQ_PERMISSION_KEYS.map((k) => [k, false]));
  for (const grant of grants.recordset) {
    if (grant.Allowed && grant.PermissionKey in can) can[grant.PermissionKey] = true;
  }

  return { cq: can.cq_view ? base : null, can };
}

export async function requireCodeQualityPermission(permissionKey: string): Promise<CqSession | NextResponse> {
  const cq = await resolveCqSession(permissionKey);
  if (!cq) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return cq;
}

export function isCqSession(value: CqSession | NextResponse): value is CqSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead of
// a 403 response so pages can render their own "not allowed" state.
export async function getCqSession(permissionKey: string): Promise<CqSession | null> {
  return resolveCqSession(permissionKey);
}
