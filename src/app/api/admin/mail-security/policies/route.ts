import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { createPolicySchema } from "@/lib/mailSecurity/schema";

export async function GET() {
  const mail = await requireMailPolicyPermission("mail_view");
  if (!isMailSession(mail)) return mail;

  const db = await getDb();
  const result = await db.query(`
    SELECT p.Id, p.Name, p.Description, p.Enabled, p.Mandatory, p.Direction, p.Priority, p.Action,
      p.NotifySender, p.NotifyRecipient, p.NotifyAdminEmail,
      CONVERT(VARCHAR(19), p.CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), p.UpdatedAt, 126) AS UpdatedAt,
      (SELECT COUNT(*) FROM MailSecurityIncidents i WHERE i.MatchedPolicyId = p.Id) AS MatchCount,
      (SELECT MAX(CONVERT(VARCHAR(19), i.DetectedAt, 126)) FROM MailSecurityIncidents i WHERE i.MatchedPolicyId = p.Id) AS LastTriggeredAt
    FROM MailBlockingPolicies p
    WHERE p.DeletedAt IS NULL
    ORDER BY p.Mandatory DESC, p.Priority ASC, p.Name ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const mail = await requireMailPolicyPermission("mail_policy_create");
  if (!isMailSession(mail)) return mail;

  const body = await req.json().catch(() => null);
  const parsed = createPolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid policy payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const inserted = await db
    .request()
    .input("name", sql.NVarChar, p.name)
    .input("description", sql.NVarChar, p.description ?? null)
    .input("enabled", sql.Bit, p.enabled)
    .input("mandatory", sql.Bit, p.mandatory)
    .input("direction", sql.VarChar, p.direction)
    .input("priority", sql.Int, p.priority)
    .input("action", sql.VarChar, p.action)
    .input("rulesJson", sql.NVarChar(sql.MAX), JSON.stringify(p.rules))
    .input("urlPatternsJson", sql.NVarChar(sql.MAX), p.urlRules ? JSON.stringify(p.urlRules) : null)
    .input("notifySender", sql.Bit, p.notifySender)
    .input("notifyRecipient", sql.Bit, p.notifyRecipient)
    .input("notifyAdminEmail", sql.NVarChar, p.notifyAdminEmail ?? null)
    .input("createdByUserId", sql.Int, mail.userId)
    .query<{ Id: number }>(`
      INSERT INTO MailBlockingPolicies
        (Name, Description, Enabled, Mandatory, Direction, Priority, Action, RulesJson, UrlPatternsJson, NotifySender, NotifyRecipient, NotifyAdminEmail, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @description, @enabled, @mandatory, @direction, @priority, @action, @rulesJson, @urlPatternsJson, @notifySender, @notifyRecipient, @notifyAdminEmail, @createdByUserId)
    `);
  const policyId = inserted.recordset[0].Id;

  for (const scope of p.scopes) {
    await db
      .request()
      .input("policyId", sql.Int, policyId)
      .input("scopeType", sql.VarChar, scope.scopeType)
      .input("scopeValue", sql.NVarChar, scope.scopeValue ?? null)
      .query("INSERT INTO MailPolicyScopes (PolicyId, ScopeType, ScopeValue) VALUES (@policyId, @scopeType, @scopeValue)");
  }

  await logAdminAction({ admin: mail, section: "mail-security", action: "policy_create", details: p.name, req });

  return NextResponse.json({ ok: true, data: { id: policyId } });
}
