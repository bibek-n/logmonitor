import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid passkey id" });
  }

  const db = await getDb();
  // Scoped to the caller's own UserId — one admin can never delete another's passkey by
  // guessing an id.
  await db
    .request()
    .input("id", sql.Int, id)
    .input("userId", sql.Int, admin.userId)
    .query("DELETE FROM UserPasskeys WHERE Id = @id AND UserId = @userId");

  return NextResponse.json({ ok: true });
}
