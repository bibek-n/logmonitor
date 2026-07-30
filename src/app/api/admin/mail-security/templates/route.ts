import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";

export async function GET() {
  const mail = await requireMailPolicyPermission("mail_view");
  if (!isMailSession(mail)) return mail;

  const db = await getDb();
  const result = await db.query(
    "SELECT Id, EventType, Subject, Body, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt FROM MailNotificationTemplates ORDER BY EventType ASC"
  );

  return NextResponse.json({ ok: true, data: result.recordset });
}
