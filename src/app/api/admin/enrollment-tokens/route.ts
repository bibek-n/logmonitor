import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { generateEnrollmentToken } from "@/lib/agentAuth";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

const TOKEN_TTL_HOURS = 24;

export async function POST() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const token = generateEnrollmentToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000);

  const db = await getDb();
  await db
    .request()
    .input("token", sql.VarChar, token)
    .input("createdBy", sql.Int, admin.userId)
    .input("expiresAt", sql.DateTime2, expiresAt)
    .query("INSERT INTO EnrollmentTokens (Token, CreatedByUserId, ExpiresAt) VALUES (@token, @createdBy, @expiresAt)");

  return NextResponse.json({ ok: true, token, expiresAt: expiresAt.toISOString() });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Token: string;
    CreatedAt: string;
    ExpiresAt: string;
    UsedAt: string | null;
    UsedByDeviceId: string | null;
  }>("SELECT TOP 50 Id, Token, CreatedAt, ExpiresAt, UsedAt, UsedByDeviceId FROM EnrollmentTokens ORDER BY CreatedAt DESC");

  return NextResponse.json({ ok: true, tokens: result.recordset });
}
