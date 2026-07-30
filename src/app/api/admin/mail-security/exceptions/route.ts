import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { createExceptionSchema } from "@/lib/mailSecurity/schema";

export async function GET() {
  const mail = await requireMailPolicyPermission("mail_view");
  if (!isMailSession(mail)) return mail;

  const db = await getDb();
  const result = await db.query(`
    SELECT e.Id, e.PolicyId, p.Name AS PolicyName, e.ExceptionType, e.ExceptionValue, e.Reason, e.ApprovedByUserId, u.Username AS ApprovedByUsername,
      CONVERT(VARCHAR(19), e.ExpiresAt, 126) AS ExpiresAt, CONVERT(VARCHAR(19), e.RevokedAt, 126) AS RevokedAt,
      CONVERT(VARCHAR(19), e.CreatedAt, 126) AS CreatedAt
    FROM MailPolicyExceptions e
    LEFT JOIN MailBlockingPolicies p ON p.Id = e.PolicyId
    LEFT JOIN Users u ON u.Id = e.ApprovedByUserId
    ORDER BY e.CreatedAt DESC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const mail = await requireMailPolicyPermission("mail_manage_exceptions");
  if (!isMailSession(mail)) return mail;

  const body = await req.json().catch(() => null);
  const parsed = createExceptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid exception payload" }, { status: 400 });
  }
  const e = parsed.data;

  const db = await getDb();

  if (e.policyId !== null && e.policyId !== undefined) {
    const policyExists = await db
      .request()
      .input("id", sql.Int, e.policyId)
      .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM MailBlockingPolicies WHERE Id = @id AND DeletedAt IS NULL");
    if (policyExists.recordset[0].Cnt === 0) {
      return NextResponse.json({ ok: false, error: "Policy not found" }, { status: 400 });
    }
    const mandatoryCheck = await db
      .request()
      .input("id", sql.Int, e.policyId)
      .query<{ Mandatory: boolean }>("SELECT Mandatory FROM MailBlockingPolicies WHERE Id = @id");
    if (mandatoryCheck.recordset[0]?.Mandatory) {
      return NextResponse.json({ ok: false, error: "Cannot add an exception to a mandatory policy - mandatory policies cannot be overridden" }, { status: 400 });
    }
  }

  const inserted = await db
    .request()
    .input("policyId", sql.Int, e.policyId ?? null)
    .input("exceptionType", sql.VarChar, e.exceptionType)
    .input("exceptionValue", sql.NVarChar, e.exceptionValue)
    .input("reason", sql.NVarChar, e.reason)
    .input("approvedByUserId", sql.Int, mail.userId)
    .input("expiresAt", sql.DateTime2, e.expiresAt ?? null)
    .query<{ Id: number }>(`
      INSERT INTO MailPolicyExceptions (PolicyId, ExceptionType, ExceptionValue, Reason, ApprovedByUserId, ExpiresAt)
      OUTPUT INSERTED.Id
      VALUES (@policyId, @exceptionType, @exceptionValue, @reason, @approvedByUserId, @expiresAt)
    `);

  await logAdminAction({ admin: mail, section: "mail-security", action: "exception_add", details: `${e.exceptionType}: ${e.exceptionValue}`, req });

  return NextResponse.json({ ok: true, data: { id: inserted.recordset[0].Id } });
}
