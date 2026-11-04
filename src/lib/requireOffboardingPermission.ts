import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface OffboardingSession {
  userId: number;
  username: string;
  role: string;
}

// Employee Offboarding module's permission gate - same PERMISSION_KEYS/RolePermissions
// mechanism as every other enforced module (requireRemoteAccessPermission.ts is the template
// this copies). Admin always passes regardless of RolePermissions, same superuser convention
// used everywhere else in this app. Deliberately scoped to /api/admin/offboarding/** only.
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
    const userRow = await db.request().input("username", sql.NVarChar, username).query<{ Id: number }>("SELECT Id FROM Users WHERE Username = @username");
    userId = userRow.recordset[0]?.Id ?? null;
  }
  if (userId === null) return null;

  return { userId, username, role };
}

async function resolveOffboardingSession(permissionKey: string): Promise<OffboardingSession | null> {
  const base = await resolveBaseSession();
  if (!base) return null;
  if (base.role === "Admin") return base;

  const db = await getDb();
  const grant = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .input("key", sql.NVarChar, permissionKey)
    .query<{ Allowed: boolean }>("SELECT rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role AND rp.PermissionKey = @key");
  const allowed = grant.recordset[0]?.Allowed === true;
  return allowed ? base : null;
}

export async function requireOffboardingPermission(permissionKey: string): Promise<OffboardingSession | NextResponse> {
  const offboarding = await resolveOffboardingSession(permissionKey);
  if (!offboarding) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return offboarding;
}

export function isOffboardingSession(value: OffboardingSession | NextResponse): value is OffboardingSession {
  return !(value instanceof NextResponse);
}

export async function getOffboardingSession(permissionKey: string): Promise<OffboardingSession | null> {
  return resolveOffboardingSession(permissionKey);
}
