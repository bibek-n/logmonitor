import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface RemoteSupportSession {
  userId: number;
  username: string;
  role: string;
}

// Same base-session resolution as requireQaPermission.ts - kept as its own copy rather than
// a shared import so each permissioned module's gate stays independently auditable.
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

// Remote Support requires the CALLER'S OWN account (not just their role) to have TOTP
// enabled - checked on every single request, unconditionally, even for Admin. This app's JWT
// sessions carry no per-request re-auth/step-up timestamp, so there's no way to ask "did this
// admin verify MFA recently"; requiring the account to have MFA enabled at all is the
// strongest gate available without changing the wider auth system (see the Phase 1
// architecture doc, "Key Trade-offs" #2). Deliberately placed before the Admin bypass below -
// an Admin without TOTP enabled is refused exactly like anyone else.
async function hasMfaEnabled(userId: number): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, userId)
    .query<{ TotpEnabled: boolean }>("SELECT TotpEnabled FROM Users WHERE Id = @id");
  return result.recordset[0]?.TotpEnabled === true;
}

async function resolveRemoteSupportSession(permissionKey: string): Promise<RemoteSupportSession | null> {
  const base = await resolveBaseSession();
  if (!base) return null;
  if (!(await hasMfaEnabled(base.userId))) return null;
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

export const REMOTE_SUPPORT_PERMISSION_KEYS = [
  "remote_support_request",
  "remote_support_control",
  "remote_support_file_transfer",
  "remote_support_admin",
] as const;

// For Server Component pages: resolves every remote_support_* grant for the caller at once so
// the console can show/hide several buttons without a round trip per button. Every mutation
// route still independently re-derives and re-checks via requireRemoteSupportPermission() -
// hiding a button here changes nothing about what the server will actually allow.
export async function getRemoteSupportAccess(): Promise<{ session: RemoteSupportSession | null; can: Record<string, boolean> }> {
  const base = await resolveBaseSession();
  if (!base || !(await hasMfaEnabled(base.userId))) return { session: null, can: {} };

  if (base.role === "Admin") {
    return { session: base, can: Object.fromEntries(REMOTE_SUPPORT_PERMISSION_KEYS.map((k) => [k, true])) };
  }

  const db = await getDb();
  const grants = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .query<{ PermissionKey: string; Allowed: boolean }>(
      "SELECT rp.PermissionKey, rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role"
    );

  const can: Record<string, boolean> = Object.fromEntries(REMOTE_SUPPORT_PERMISSION_KEYS.map((k) => [k, false]));
  for (const grant of grants.recordset) {
    if (grant.Allowed && grant.PermissionKey in can) can[grant.PermissionKey] = true;
  }

  return { session: can.remote_support_request ? base : null, can };
}

export async function requireRemoteSupportPermission(permissionKey: string): Promise<RemoteSupportSession | NextResponse> {
  const rs = await resolveRemoteSupportSession(permissionKey);
  if (!rs) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return rs;
}

export function isRemoteSupportSession(value: RemoteSupportSession | NextResponse): value is RemoteSupportSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse).
export async function getRemoteSupportSession(permissionKey: string): Promise<RemoteSupportSession | null> {
  return resolveRemoteSupportSession(permissionKey);
}
