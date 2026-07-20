import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession, type AdminSession } from "@/lib/requireAdmin";

export type SecurityRole = "security_admin" | "security_analyst" | "viewer";

const ROLE_RANK: Record<SecurityRole, number> = { viewer: 0, security_analyst: 1, security_admin: 2 };

export interface SecuritySession extends AdminSession {
  securityRole: SecurityRole;
}

// Layered on top of the app's existing requireAdmin() gate (same authentication reuse the
// rest of this app follows) rather than replacing it - this only ever narrows access
// further, never widens it. Real per-user tiers live in SecurityUserRoles; a user with no
// row there defaults to security_admin, because this app's Users table only seeds a single
// "Admin" role today (see requireAdmin.ts's own note) - every current user is already
// fully trusted app-wide, so defaulting them to the highest IDS tier doesn't grant anything
// they didn't already effectively have. Once non-Admin app roles exist, assigning a lower
// SecurityUserRoles row to a given user immediately takes effect with no other code change.
export async function requireSecurityRole(minRole: SecurityRole): Promise<SecuritySession | NextResponse> {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.request().input("userId", sql.Int, admin.userId).query<{ Role: string }>(`SELECT Role FROM SecurityUserRoles WHERE UserId = @userId`);
  const role = (result.recordset[0]?.Role as SecurityRole | undefined) ?? "security_admin";

  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    return NextResponse.json({ ok: false, error: `This action requires the ${minRole} role.` }, { status: 403 });
  }

  return { ...admin, securityRole: role };
}

export function isSecuritySession(value: SecuritySession | NextResponse): value is SecuritySession {
  return !(value instanceof NextResponse);
}
