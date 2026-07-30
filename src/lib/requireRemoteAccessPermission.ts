import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface RemoteAccessSession {
  userId: number;
  username: string;
  role: string;
}

// Remote Access module's permission gate — same PERMISSION_KEYS/RolePermissions mechanism as
// every other enforced module (see requireSecurityCenterPermission.ts, the template this
// copies). Deliberately scoped to /api/admin/remote-access/** only.
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

async function resolveRemoteAccessSession(permissionKey: string): Promise<RemoteAccessSession | null> {
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

export const REMOTE_ACCESS_PERMISSION_KEYS = [
  "ra_view",
  "ra_connections_view",
  "ra_connections_create",
  "ra_connections_edit",
  "ra_connections_delete",
  "ra_ssh_start",
  "ra_rdp_start",
  "ra_vnc_start",
  "ra_file_transfer_use",
  "ra_file_upload",
  "ra_file_download",
  "ra_file_delete",
  "ra_credentials_use",
  "ra_credentials_reveal",
  "ra_credentials_manage",
  "ra_ssh_keys_manage",
  "ra_commands_execute",
  "ra_scripts_execute",
  "ra_bulk_execute",
  "ra_device_restart",
  "ra_device_shutdown",
  "ra_session_logs_view",
  "ra_audit_logs_view",
  "ra_settings_manage",
  "ra_port_forwarding_manage",
] as const;

// For Server Component pages: one query resolving every ra_* grant for the caller's role at
// once, so a page needing to show/hide several buttons doesn't do a round trip per button.
// UI convenience only — every mutation route still independently re-checks via
// requireRemoteAccessPermission(), so hiding a button here changes nothing about enforcement.
export async function getRemoteAccessAccess(): Promise<{ remoteAccess: RemoteAccessSession | null; can: Record<string, boolean> }> {
  const base = await resolveBaseSession();
  if (!base) return { remoteAccess: null, can: {} };

  if (base.role === "Admin") {
    return { remoteAccess: base, can: Object.fromEntries(REMOTE_ACCESS_PERMISSION_KEYS.map((k) => [k, true])) };
  }

  const db = await getDb();
  const grants = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .query<{ PermissionKey: string; Allowed: boolean }>(
      "SELECT rp.PermissionKey, rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role"
    );

  const can: Record<string, boolean> = Object.fromEntries(REMOTE_ACCESS_PERMISSION_KEYS.map((k) => [k, false]));
  for (const grant of grants.recordset) {
    if (grant.Allowed && grant.PermissionKey in can) can[grant.PermissionKey] = true;
  }

  return { remoteAccess: can.ra_view ? base : null, can };
}

export async function requireRemoteAccessPermission(permissionKey: string): Promise<RemoteAccessSession | NextResponse> {
  const remoteAccess = await resolveRemoteAccessSession(permissionKey);
  if (!remoteAccess) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return remoteAccess;
}

export function isRemoteAccessSession(value: RemoteAccessSession | NextResponse): value is RemoteAccessSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead of
// a 403 response so pages can render their own "not allowed" state.
export async function getRemoteAccessSession(permissionKey: string): Promise<RemoteAccessSession | null> {
  return resolveRemoteAccessSession(permissionKey);
}
