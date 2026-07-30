import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface SecurityCenterSession {
  userId: number;
  username: string;
  role: string;
}

// Security Center module's permission gate — same PERMISSION_KEYS/RolePermissions mechanism as
// every other enforced module (see requireAutomationPermission.ts, the template this copies).
// Deliberately scoped to /api/admin/security-center/** only, and deliberately separate from
// Intrusion Detection's own SecurityUserRoles/requireSecurityRole system, which keeps gating
// the pre-existing Security Center nav items unchanged.
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

async function resolveSecurityCenterSession(permissionKey: string): Promise<SecurityCenterSession | null> {
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

export const SECURITY_CENTER_PERMISSION_KEYS = [
  "sc_view",
  "sc_vuln_scan_run",
  "sc_vuln_finding_update",
  "sc_waf_manage",
  "sc_settings_manage",
] as const;

// For Server Component pages: one query resolving every sc_* grant for the caller's role at
// once, so a page needing to show/hide several buttons doesn't do a round trip per button.
// UI convenience only — every mutation route still independently re-checks via
// requireSecurityCenterPermission(), so hiding a button here changes nothing about enforcement.
export async function getSecurityCenterAccess(): Promise<{ securityCenter: SecurityCenterSession | null; can: Record<string, boolean> }> {
  const base = await resolveBaseSession();
  if (!base) return { securityCenter: null, can: {} };

  if (base.role === "Admin") {
    return { securityCenter: base, can: Object.fromEntries(SECURITY_CENTER_PERMISSION_KEYS.map((k) => [k, true])) };
  }

  const db = await getDb();
  const grants = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .query<{ PermissionKey: string; Allowed: boolean }>(
      "SELECT rp.PermissionKey, rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role"
    );

  const can: Record<string, boolean> = Object.fromEntries(SECURITY_CENTER_PERMISSION_KEYS.map((k) => [k, false]));
  for (const grant of grants.recordset) {
    if (grant.Allowed && grant.PermissionKey in can) can[grant.PermissionKey] = true;
  }

  return { securityCenter: can.sc_view ? base : null, can };
}

export async function requireSecurityCenterPermission(permissionKey: string): Promise<SecurityCenterSession | NextResponse> {
  const securityCenter = await resolveSecurityCenterSession(permissionKey);
  if (!securityCenter) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return securityCenter;
}

export function isSecurityCenterSession(value: SecurityCenterSession | NextResponse): value is SecurityCenterSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead of
// a 403 response so pages can render their own "not allowed" state.
export async function getSecurityCenterSession(permissionKey: string): Promise<SecurityCenterSession | null> {
  return resolveSecurityCenterSession(permissionKey);
}
