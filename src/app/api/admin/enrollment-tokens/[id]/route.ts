import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const tokenId = Number(id);
  if (!Number.isInteger(tokenId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("id", sql.Int, tokenId).query("DELETE FROM EnrollmentTokens WHERE Id = @id");
  if (result.rowsAffected[0] === 0) {
    return NextResponse.json({ ok: false, error: "Token not found" }, { status: 404 });
  }

  await logAdminAction({ admin, section: "endpoint_agents", action: "delete_enrollment_token", details: String(tokenId), req });

  return NextResponse.json({ ok: true });
}
