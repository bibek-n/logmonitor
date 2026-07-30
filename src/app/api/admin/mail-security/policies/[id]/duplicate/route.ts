import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { loadPolicyById } from "@/lib/mailSecurity/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_policy_create");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const policy = await loadPolicyById(Number(id));
  if (!policy) return NextResponse.json({ ok: false, error: "Policy not found" }, { status: 404 });

  const db = await getDb();
  const inserted = await db
    .request()
    .input("name", sql.NVarChar, `${policy.name} (Copy)`)
    .input("description", sql.NVarChar, policy.description)
    .input("mandatory", sql.Bit, false) // a duplicate never inherits Mandatory - avoids silently doubling an un-overridable policy
    .input("direction", sql.VarChar, policy.direction)
    .input("priority", sql.Int, policy.priority)
    .input("action", sql.VarChar, policy.action)
    .input("rulesJson", sql.NVarChar(sql.MAX), JSON.stringify(policy.rules))
    .input("urlPatternsJson", sql.NVarChar(sql.MAX), policy.urlRules ? JSON.stringify(policy.urlRules) : null)
    .input("notifySender", sql.Bit, policy.notifySender)
    .input("notifyRecipient", sql.Bit, policy.notifyRecipient)
    .input("notifyAdminEmail", sql.NVarChar, policy.notifyAdminEmail)
    .input("createdByUserId", sql.Int, mail.userId)
    .query<{ Id: number }>(`
      INSERT INTO MailBlockingPolicies
        (Name, Description, Enabled, Mandatory, Direction, Priority, Action, RulesJson, UrlPatternsJson, NotifySender, NotifyRecipient, NotifyAdminEmail, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @description, 0, @mandatory, @direction, @priority, @action, @rulesJson, @urlPatternsJson, @notifySender, @notifyRecipient, @notifyAdminEmail, @createdByUserId)
    `);
  const newId = inserted.recordset[0].Id;

  for (const scope of policy.scopes) {
    await db
      .request()
      .input("policyId", sql.Int, newId)
      .input("scopeType", sql.VarChar, scope.scopeType)
      .input("scopeValue", sql.NVarChar, scope.scopeValue)
      .query("INSERT INTO MailPolicyScopes (PolicyId, ScopeType, ScopeValue) VALUES (@policyId, @scopeType, @scopeValue)");
  }

  await logAdminAction({ admin: mail, section: "mail-security", action: "policy_duplicate", details: `${policy.name} -> ${newId}`, req });

  return NextResponse.json({ ok: true, data: { id: newId }, note: "Duplicated as disabled - review and enable when ready." });
}
