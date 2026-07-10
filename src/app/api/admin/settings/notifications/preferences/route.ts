import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`SELECT EmailEnabled, SmsEnabled, PushEnabled, InAppEnabled FROM NotificationPreferences WHERE Id = 1`;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const db = await getDb();
  await db
    .request()
    .input("emailEnabled", sql.Bit, !!body.emailEnabled)
    .input("smsEnabled", sql.Bit, !!body.smsEnabled)
    .input("pushEnabled", sql.Bit, !!body.pushEnabled)
    .input("inAppEnabled", sql.Bit, !!body.inAppEnabled)
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE NotificationPreferences SET
        EmailEnabled = @emailEnabled, SmsEnabled = @smsEnabled, PushEnabled = @pushEnabled, InAppEnabled = @inAppEnabled,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);

  await logAdminAction({ admin, section: "notifications", action: "update_preferences", req });

  return NextResponse.json({ ok: true });
}
