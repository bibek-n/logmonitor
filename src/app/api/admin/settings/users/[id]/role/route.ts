import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// The real Admin/Employee flip on Users.Role — this is the sole column requireAdmin.ts's
// resolveAdminSession() checks, so this route IS the actual authorization change.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const userId = Number(id);
  const body = await req.json().catch(() => null);
  const role = body?.role === "Admin" ? "Admin" : body?.role === "Employee" ? "Employee" : null;
  if (!Number.isInteger(userId) || !role) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();

  if (role === "Employee") {
    const adminCount = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM Users WHERE Role = 'Admin'`;
    const target = await db.request().input("id", sql.Int, userId).query<{ Role: string }>("SELECT Role FROM Users WHERE Id = @id");
    if (target.recordset[0]?.Role === "Admin" && adminCount.recordset[0].Cnt <= 1) {
      return NextResponse.json({ ok: false, error: "Cannot demote the last remaining Admin account." }, { status: 400 });
    }
  }

  await db.request().input("id", sql.Int, userId).input("role", sql.NVarChar, role).query("UPDATE Users SET Role = @role WHERE Id = @id");

  await logAdminAction({ admin, section: "users_access", action: "change_role", details: `userId=${userId} -> ${role}`, req });

  return NextResponse.json({ ok: true });
}
