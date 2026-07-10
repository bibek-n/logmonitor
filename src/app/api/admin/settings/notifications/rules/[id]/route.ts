import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const ruleId = Number(id);
  const body = await req.json().catch(() => null);
  if (!Number.isInteger(ruleId) || !body) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, ruleId)
    .input("emailEnabled", sql.Bit, !!body.emailEnabled)
    .input("smsEnabled", sql.Bit, !!body.smsEnabled)
    .input("pushEnabled", sql.Bit, !!body.pushEnabled)
    .input("inAppEnabled", sql.Bit, !!body.inAppEnabled)
    .query(`
      UPDATE NotificationRules SET
        EmailEnabled = @emailEnabled, SmsEnabled = @smsEnabled, PushEnabled = @pushEnabled, InAppEnabled = @inAppEnabled,
        UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  await logAdminAction({ admin, section: "notifications", action: "update_rule", details: `id=${ruleId}`, req });

  return NextResponse.json({ ok: true });
}
