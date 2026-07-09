import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./authOptions";

export interface AdminSession {
  userId: number;
  username: string;
}

// Shared gate for the new admin-only endpoint-agent routes. Note: today the Users table
// only ever seeds the "Admin" role, so this check currently passes for every logged-in
// user — it becomes meaningful once a second, non-admin role exists.
export async function requireAdmin(): Promise<AdminSession | NextResponse> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!session || role !== "Admin" || !userId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return { userId: Number(userId), username: session.user?.name ?? "unknown" };
}

export function isAdminSession(value: AdminSession | NextResponse): value is AdminSession {
  return !(value instanceof NextResponse);
}

// Page-safe variant (Server Components can't return a NextResponse) — returns null instead
// of a 403 response so pages can render their own "not allowed" state.
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || role !== "Admin" || !userId) return null;
  return { userId: Number(userId), username: session.user?.name ?? "unknown" };
}
