import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export interface SmtpSettingsData {
  Host: string | null;
  Port: number | null;
  Username: string | null;
  PasswordSet: boolean;
  Encryption: string | null;
  SenderName: string | null;
  SenderEmail: string | null;
  ReplyTo: string | null;
  LastTestAt: string | null;
  LastTestSuccess: boolean | null;
  LastTestMessage: string | null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`
    SELECT Host, Port, Username, Encryption, SenderName, SenderEmail, ReplyTo,
      CASE WHEN Password IS NOT NULL AND Password <> '' THEN 1 ELSE 0 END AS PasswordSet,
      CONVERT(VARCHAR(19), LastTestAt, 126) AS LastTestAt, LastTestSuccess, LastTestMessage
    FROM SmtpSettings WHERE Id = 1
  `;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const db = await getDb();
  await db
    .request()
    .input("host", sql.NVarChar, str(body.host))
    .input("port", sql.Int, Number.isInteger(body.port) ? body.port : 587)
    .input("username", sql.NVarChar, str(body.username))
    .input("password", sql.NVarChar, str(body.password))
    .input("encryption", sql.VarChar, str(body.encryption) ?? "TLS")
    .input("senderName", sql.NVarChar, str(body.senderName))
    .input("senderEmail", sql.NVarChar, str(body.senderEmail))
    .input("replyTo", sql.NVarChar, str(body.replyTo))
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE SmtpSettings SET
        Host = @host, Port = @port, Username = @username,
        Password = COALESCE(@password, Password),
        Encryption = @encryption, SenderName = @senderName, SenderEmail = @senderEmail, ReplyTo = @replyTo,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);

  await logAdminAction({ admin, section: "smtp_email", action: "update_smtp_settings", req });

  return NextResponse.json({ ok: true });
}
