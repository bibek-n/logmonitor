import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";

// "Update" on an exception is limited to revoking it early or changing its expiry - the
// approval fields (Reason/ApprovedByUserId/ExceptionValue) are immutable once created so the
// audit trail of who approved what never silently changes; to change the value, create a new
// exception and revoke the old one.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_manage_exceptions");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const expiresAt = typeof body?.expiresAt === "string" || body?.expiresAt === null ? body.expiresAt : undefined;
  if (expiresAt === undefined) {
    return NextResponse.json({ ok: false, error: "expiresAt (ISO string or null) is required" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, Number(id))
    .query<{ ExceptionValue: string }>("SELECT ExceptionValue FROM MailPolicyExceptions WHERE Id = @id AND RevokedAt IS NULL");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Exception not found" }, { status: 404 });

  await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("expiresAt", sql.DateTime2, expiresAt)
    .query("UPDATE MailPolicyExceptions SET ExpiresAt = @expiresAt WHERE Id = @id");

  await logAdminAction({ admin: mail, section: "mail-security", action: "exception_update", details: existing.recordset[0].ExceptionValue, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_manage_exceptions");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, Number(id))
    .query<{ ExceptionValue: string }>("SELECT ExceptionValue FROM MailPolicyExceptions WHERE Id = @id AND RevokedAt IS NULL");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Exception not found" }, { status: 404 });

  await db.request().input("id", sql.Int, Number(id)).query("UPDATE MailPolicyExceptions SET RevokedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin: mail, section: "mail-security", action: "exception_revoke", details: existing.recordset[0].ExceptionValue, req });

  return NextResponse.json({ ok: true });
}
