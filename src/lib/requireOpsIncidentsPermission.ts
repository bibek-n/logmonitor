import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface OpsIncidentsSession {
  userId: number;
  username: string;
  role: string;
}

// Incident Management module's permission gate - same PERMISSION_KEYS/RolePermissions
// mechanism as every other enforced module (requireKnowledgeBasePermission.ts is the template
// this copies). Scoped to /api/admin/ops-incidents/** only.
//
// Admin always passes regardless of RolePermissions - same superuser convention used
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

async function resolveOpsIncidentsSession(permissionKey: string): Promise<OpsIncidentsSession | null> {
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

export const OPS_INCIDENTS_PERMISSION_KEYS = ["oi_view", "oi_manage"] as const;

export async function getOpsIncidentsAccess(): Promise<{ oi: OpsIncidentsSession | null; can: Record<string, boolean> }> {
  const base = await resolveBaseSession();
  if (!base) return { oi: null, can: {} };

  if (base.role === "Admin") {
    return { oi: base, can: Object.fromEntries(OPS_INCIDENTS_PERMISSION_KEYS.map((k) => [k, true])) };
  }

  const db = await getDb();
  const grants = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .query<{ PermissionKey: string; Allowed: boolean }>(
      "SELECT rp.PermissionKey, rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role"
    );

  const can: Record<string, boolean> = Object.fromEntries(OPS_INCIDENTS_PERMISSION_KEYS.map((k) => [k, false]));
  for (const grant of grants.recordset) {
    if (grant.Allowed && grant.PermissionKey in can) can[grant.PermissionKey] = true;
  }

  return { oi: can.oi_view ? base : null, can };
}

export async function requireOpsIncidentsPermission(permissionKey: string): Promise<OpsIncidentsSession | NextResponse> {
  const oi = await resolveOpsIncidentsSession(permissionKey);
  if (!oi) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return oi;
}

export function isOpsIncidentsSession(value: OpsIncidentsSession | NextResponse): value is OpsIncidentsSession {
  return !(value instanceof NextResponse);
}

export async function getOpsIncidentsSession(permissionKey: string): Promise<OpsIncidentsSession | null> {
  return resolveOpsIncidentsSession(permissionKey);
}
