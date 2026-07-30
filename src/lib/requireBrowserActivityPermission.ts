import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface BrowserActivitySession {
  userId: number;
  username: string;
  role: string;
}

// Browser Activity Audit module's permission gate — same PERMISSION_KEYS/RolePermissions
// mechanism as every other enforced module (see requireSecurityCenterPermission.ts, the
// template this copies). Deliberately scoped to /api/admin/browser-activity/** only.
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

async function resolveBrowserActivitySession(permissionKey: string): Promise<BrowserActivitySession | null> {
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

export const BROWSER_ACTIVITY_PERMISSION_KEYS = [
  "ba_view",
  "ba_view_page_titles",
  "ba_view_security_alerts",
  "ba_search",
  "ba_export",
  "ba_categories_manage",
  "ba_excluded_domains_manage",
  "ba_settings_manage",
  "ba_device_enable",
  "ba_audit_log_view",
  "ba_delete",
] as const;

// For Server Component pages: one query resolving every ba_* grant for the caller's role at
// once, so a page needing to show/hide several buttons (e.g. Export, page-title masking)
// doesn't do a round trip per button. UI convenience only — every mutation/read route still
// independently re-checks via requireBrowserActivityPermission(), so hiding a button here
// changes nothing about enforcement.
export async function getBrowserActivityAccess(): Promise<{ browserActivity: BrowserActivitySession | null; can: Record<string, boolean> }> {
  const base = await resolveBaseSession();
  if (!base) return { browserActivity: null, can: {} };

  if (base.role === "Admin") {
    return { browserActivity: base, can: Object.fromEntries(BROWSER_ACTIVITY_PERMISSION_KEYS.map((k) => [k, true])) };
  }

  const db = await getDb();
  const grants = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .query<{ PermissionKey: string; Allowed: boolean }>(
      "SELECT rp.PermissionKey, rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role"
    );

  const can: Record<string, boolean> = Object.fromEntries(BROWSER_ACTIVITY_PERMISSION_KEYS.map((k) => [k, false]));
  for (const grant of grants.recordset) {
    if (grant.Allowed && grant.PermissionKey in can) can[grant.PermissionKey] = true;
  }

  return { browserActivity: can.ba_view ? base : null, can };
}

export async function requireBrowserActivityPermission(permissionKey: string): Promise<BrowserActivitySession | NextResponse> {
  const browserActivity = await resolveBrowserActivitySession(permissionKey);
  if (!browserActivity) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return browserActivity;
}

export function isBrowserActivitySession(value: BrowserActivitySession | NextResponse): value is BrowserActivitySession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead of
// a 403 response so pages can render their own "not allowed" state.
export async function getBrowserActivitySession(permissionKey: string): Promise<BrowserActivitySession | null> {
  return resolveBrowserActivitySession(permissionKey);
}
