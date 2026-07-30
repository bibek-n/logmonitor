import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { updateTemplateSchema } from "@/lib/mailSecurity/schema";
import { renderTemplate } from "@/lib/mailSecurity/notifications";

const SAMPLE_VARS = {
  sender: "sender@example.com",
  recipient: "recipient@example.com",
  subject: "Quarterly report",
  file_name: "invoice.exe",
  detected_type: "Windows executable (PE/EXE)",
  policy_name: "Default Dangerous File Protection",
  block_reason: "Extension .exe is blocked",
  incident_id: "00000000-0000-0000-0000-000000000000",
  timestamp: new Date(0).toISOString(),
  support_email: "support@example.com",
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_manage_templates");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid template payload" }, { status: 400 });
  }

  // Render with sample values before saving, purely to catch malformed {{var}} syntax early -
  // renderTemplate never throws (unmatched tokens are left as-is), so this is a preview, not
  // a hard validation gate.
  const preview = { subject: renderTemplate(parsed.data.subject, SAMPLE_VARS), body: renderTemplate(parsed.data.body, SAMPLE_VARS) };

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, Number(id)).query<{ EventType: string }>("SELECT EventType FROM MailNotificationTemplates WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });

  await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("subject", sql.NVarChar, parsed.data.subject)
    .input("body", sql.NVarChar(sql.MAX), parsed.data.body)
    .input("updatedByUserId", sql.Int, mail.userId)
    .query("UPDATE MailNotificationTemplates SET Subject = @subject, Body = @body, UpdatedByUserId = @updatedByUserId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin: mail, section: "mail-security", action: "template_update", details: existing.recordset[0].EventType, req });

  return NextResponse.json({ ok: true, data: { preview } });
}
