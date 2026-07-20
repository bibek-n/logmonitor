import { NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, admin.userId)
    .query<{ TotpEnabled: boolean; TotpEnrolledAt: string | null }>(
      "SELECT TotpEnabled, CONVERT(VARCHAR(19), TotpEnrolledAt, 126) AS TotpEnrolledAt FROM Users WHERE Id = @id"
    );
  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  return NextResponse.json({ ok: true, enabled: row.TotpEnabled, enrolledAt: row.TotpEnrolledAt });
}
