import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface WordpressScanSession {
  userId: number;
  username: string;
  role: string;
}

// WordPress Deep Scan module's permission gate — same RolePermissions mechanism as
// requireItAssetPermission.ts (the template this copies). Deliberately scoped to
// /api/admin/wordpress-scan/** only. Admin always passes regardless of RolePermissions.
async function resolveBaseSession(): Promise<WordpressScanSession | null> {
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

async function resolveWordpressScanSession(permissionKey: string): Promise<WordpressScanSession | null> {
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

export async function requireWordpressScanPermission(permissionKey: string): Promise<WordpressScanSession | NextResponse> {
  const wps = await resolveWordpressScanSession(permissionKey);
  if (!wps) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return wps;
}

export function isWordpressScanSession(value: WordpressScanSession | NextResponse): value is WordpressScanSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead of
// a 403 response so pages can render their own "not allowed" state.
export async function getWordpressScanSession(permissionKey: string): Promise<WordpressScanSession | null> {
  return resolveWordpressScanSession(permissionKey);
}
