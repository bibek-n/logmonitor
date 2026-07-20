import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface QaSession {
  userId: number;
  username: string;
  role: string;
}

// QA Testing Management's permission gate — the first real enforcement of the
// PERMISSION_KEYS/RolePermissions mechanism anywhere in this app (everywhere else only
// checks the binary Admin/non-Admin role via requireAdmin(), since RolePermissions has been
// unenforced UI-only bookkeeping until now). Deliberately scoped to /api/admin/qa/** only —
// not retrofitted onto any other module's routes.
//
// Admin always passes, regardless of what RolePermissions says — same superuser convention
// requireAdmin() already uses everywhere else in this app, so an Admin never needs an
// explicit qa_* grant row.
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
    // Same one-time username-lookup fallback requireAdmin() uses for sessions issued
    // before the id was added to the JWT.
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

async function resolveQaSession(permissionKey: string): Promise<QaSession | null> {
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

export const QA_PERMISSION_KEYS = [
  "qa_view", "qa_create", "qa_edit", "qa_delete", "qa_execute",
  "qa_manage_runs", "qa_manage_bugs", "qa_view_reports", "qa_admin",
] as const;

// For Server Component pages (not API routes): one query resolving every qa_* grant for the
// caller's role at once, so a page needing to show/hide several buttons (Create, Edit,
// Delete, Manage Runs, ...) doesn't do a separate resolveQaSession() round trip per button.
// This is a UI convenience only — every mutation route still independently re-derives and
// re-checks permission via requireQaPermission(), so hiding a button here changes nothing
// about what the server will actually allow.
export async function getQaAccess(): Promise<{ qa: QaSession | null; can: Record<string, boolean> }> {
  const base = await resolveBaseSession();
  if (!base) return { qa: null, can: {} };

  if (base.role === "Admin") {
    return { qa: base, can: Object.fromEntries(QA_PERMISSION_KEYS.map((k) => [k, true])) };
  }

  const db = await getDb();
  const grants = await db
    .request()
    .input("role", sql.NVarChar, base.role)
    .query<{ PermissionKey: string; Allowed: boolean }>(
      "SELECT rp.PermissionKey, rp.Allowed FROM RolePermissions rp JOIN Roles r ON r.Id = rp.RoleId WHERE r.Name = @role"
    );

  const can: Record<string, boolean> = Object.fromEntries(QA_PERMISSION_KEYS.map((k) => [k, false]));
  for (const grant of grants.recordset) {
    if (grant.Allowed && grant.PermissionKey in can) can[grant.PermissionKey] = true;
  }

  return { qa: can.qa_view ? base : null, can };
}

export async function requireQaPermission(permissionKey: string): Promise<QaSession | NextResponse> {
  const qa = await resolveQaSession(permissionKey);
  if (!qa) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return qa;
}

export function isQaSession(value: QaSession | NextResponse): value is QaSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead
// of a 403 response so pages can render their own "not allowed" state.
export async function getQaSession(permissionKey: string): Promise<QaSession | null> {
  return resolveQaSession(permissionKey);
}
