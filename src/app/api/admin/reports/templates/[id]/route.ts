import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const id = Number((await params).id);
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("userId", sql.Int, admin.userId)
    .query("DELETE FROM ReportTemplates WHERE Id = @id AND CreatedByUserId = @userId");

  return NextResponse.json({ ok: true });
}
