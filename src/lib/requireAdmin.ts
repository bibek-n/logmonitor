import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";
import { getDb, sql } from "./db";

export interface AdminSession {
  userId: number;
  username: string;
}

// Shared gate for the new admin-only endpoint-agent routes. Note: today the Users table
// only ever seeds the "Admin" role, so this check currently passes for every logged-in
// user — it becomes meaningful once a second, non-admin role exists.
//
// Authorization itself only depends on `role` — a session's numeric id is only needed
// for audit-log attribution, and older sessions (issued before the id was added to the
// JWT) won't have it. Rather than denying access until the user happens to log out and
// back in, this looks the id up by username as a one-time fallback, so it's correct
// regardless of how old the session cookie is.
async function resolveAdminSession(): Promise<AdminSession | null> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "Admin") return null;

  const username = session.user?.name ?? null;
  const sessionUserId = (session.user as { id?: string } | undefined)?.id;
  if (sessionUserId) {
    return { userId: Number(sessionUserId), username: username ?? "unknown" };
  }

  if (!username) return null;
  const db = await getDb();
  const result = await db
    .request()
    .input("username", sql.NVarChar, username)
    .query<{ Id: number }>("SELECT Id FROM Users WHERE Username = @username");
  const row = result.recordset[0];
  if (!row) return null;

  return { userId: row.Id, username };
}

export async function requireAdmin(): Promise<AdminSession | NextResponse> {
  const admin = await resolveAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  return admin;
}

export function isAdminSession(value: AdminSession | NextResponse): value is AdminSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead
// of a 403 response so pages can render their own "not allowed" state.
export async function getAdminSession(): Promise<AdminSession | null> {
  return resolveAdminSession();
}
