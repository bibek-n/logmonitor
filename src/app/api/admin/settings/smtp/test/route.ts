import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { emailDeliveryTest } from "@/lib/emailTools";
import { logAdminAction } from "@/lib/adminAudit";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!to) return NextResponse.json({ ok: false, error: "A recipient email is required." }, { status: 400 });

  const db = await getDb();
  const result = await db.query<{
    Host: string | null;
    Port: number | null;
    Username: string | null;
    Password: string | null;
    SenderEmail: string | null;
  }>`SELECT Host, Port, Username, Password, SenderEmail FROM SmtpSettings WHERE Id = 1`;
  const config = result.recordset[0];

  if (!config?.Host || !config.Username || !config.Password || !config.SenderEmail) {
    return NextResponse.json({ ok: false, error: "SMTP settings are incomplete — fill in Host/Username/Password/Sender Email first." }, { status: 400 });
  }

  let message = "Test email sent successfully.";
  let success = true;
  try {
    message = await emailDeliveryTest({
      smtpHost: config.Host,
      smtpPort: config.Port ?? 587,
      username: config.Username,
      password: config.Password,
      from: config.SenderEmail,
      to,
    });
  } catch (err) {
    success = false;
    message = err instanceof Error ? err.message : "Test email failed.";
  }

  await db
    .request()
    .input("success", sql.Bit, success)
    .input("message", sql.NVarChar, message)
    .query("UPDATE SmtpSettings SET LastTestAt = SYSUTCDATETIME(), LastTestSuccess = @success, LastTestMessage = @message WHERE Id = 1");

  await db
    .request()
    .input("toAddress", sql.NVarChar, to)
    .input("subject", sql.NVarChar, "SMTP connection test")
    .input("success", sql.Bit, success)
    .input("errorMessage", sql.NVarChar, success ? null : message)
    .query("INSERT INTO EmailDeliveryLog (ToAddress, Subject, Success, ErrorMessage) VALUES (@toAddress, @subject, @success, @errorMessage)");

  await logAdminAction({ admin, section: "smtp_email", action: "send_test_email", details: `to=${to} success=${success}`, req });

  return NextResponse.json({ ok: success, message });
}
