import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const messageId = Number(id);
  if (!Number.isInteger(messageId)) {
    return NextResponse.json({ ok: false, error: "Invalid message id" }, { status: 400 });
  }

  const db = await getDb();
  await db.request().input("id", sql.Int, messageId).query("UPDATE ContactMessages SET ReadAt = SYSUTCDATETIME() WHERE Id = @id AND ReadAt IS NULL");

  return NextResponse.json({ ok: true });
}
