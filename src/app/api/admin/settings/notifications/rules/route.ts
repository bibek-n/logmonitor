import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`SELECT Id, EventName, EmailEnabled, SmsEnabled, PushEnabled, InAppEnabled FROM NotificationRules ORDER BY EventName ASC`;
  return NextResponse.json({ ok: true, data: result.recordset });
}
