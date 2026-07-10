import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const userId = Number(id);
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!Number.isInteger(userId) || password.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const db = await getDb();
  await db.request().input("id", sql.Int, userId).input("passwordHash", sql.NVarChar, passwordHash).query(
    "UPDATE Users SET PasswordHash = @passwordHash WHERE Id = @id"
  );

  await logAdminAction({ admin, section: "users_access", action: "reset_password", details: `userId=${userId}`, req });

  return NextResponse.json({ ok: true });
}
