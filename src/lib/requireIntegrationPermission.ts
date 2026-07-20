import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface IntegrationSession {
  userId: number;
  username: string;
  role: string;
}

// Shared repo-connections module's permission gate — same PERMISSION_KEYS/RolePermissions
// mechanism every other granular-permission module in this app uses (see
// requireQaPermission.ts, requireCodeQualityPermission.ts), scoped to
// /api/admin/integrations/git/** only. Deliberately its own gate rather than reusing
// requireCodeQualityPermission - this module isn't Code-Quality-specific, every module that
// syncs a project from a repo (Code Quality, Laravel Security, future ones) calls this same
// gate instead of each owning a duplicate "who can manage connections" permission.
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

async function resolveIntegrationSession(permissionKey: string): Promise<IntegrationSession | null> {
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

export const INTEGRATION_PERMISSION_KEYS = ["integrations_git_view", "integrations_git_manage"] as const;

export async function requireIntegrationPermission(permissionKey: string): Promise<IntegrationSession | NextResponse> {
  const session = await resolveIntegrationSession(permissionKey);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return session;
}

export function isIntegrationSession(value: IntegrationSession | NextResponse): value is IntegrationSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead of
// a 403 response so pages can render their own "not allowed" state.
export async function getIntegrationSession(permissionKey: string): Promise<IntegrationSession | null> {
  return resolveIntegrationSession(permissionKey);
}
