import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireMobileAdmin, isMobileSession } from "@/lib/mobileAuth";

export async function POST(req: NextRequest) {
  const admin = await requireMobileAdmin(req);
  if (!isMobileSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const staffId = body?.staffId == null ? null : Number(body.staffId);

  if (!message) return NextResponse.json({ ok: false, error: "Message is required" });
  if (message.length > 500) return NextResponse.json({ ok: false, error: "Message is too long (500 characters max)" });
  if (staffId !== null && (!Number.isInteger(staffId) || staffId <= 0)) {
    return NextResponse.json({ ok: false, error: "Invalid staffId" });
  }

  try {
    const db = await getDb();
    if (staffId !== null) {
      const staffResult = await db.request().input("id", sql.Int, staffId).query<{ Id: number }>("SELECT Id FROM Staff WHERE Id = @id");
      if (!staffResult.recordset[0]) return NextResponse.json({ ok: false, error: "Employee not found" });
    }

    await db
      .request()
      .input("staffId", sql.Int, staffId)
      .input("message", sql.NVarChar, message)
      .input("sentByUserId", sql.Int, admin.userId)
      .input("sentByUsername", sql.NVarChar, admin.username)
      .query(
        "INSERT INTO EmployeeNotifications (StaffId, Message, SentByUserId, SentByUsername) VALUES (@staffId, @message, @sentByUserId, @sentByUsername)"
      );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to send notification" });
  }
}
