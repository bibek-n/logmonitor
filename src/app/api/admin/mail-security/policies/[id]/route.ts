import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { updatePolicySchema } from "@/lib/mailSecurity/schema";
import { loadPolicyById } from "@/lib/mailSecurity/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_view");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const policy = await loadPolicyById(Number(id));
  if (!policy) return NextResponse.json({ ok: false, error: "Policy not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: policy });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_policy_update");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const policyId = Number(id);
  const existing = await loadPolicyById(policyId);
  if (!existing) return NextResponse.json({ ok: false, error: "Policy not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updatePolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid policy payload" }, { status: 400 });
  }
  const p = parsed.data;
  const merged = {
    name: p.name ?? existing.name,
    description: p.description !== undefined ? p.description : existing.description,
    enabled: p.enabled ?? existing.enabled,
    mandatory: p.mandatory ?? existing.mandatory,
    direction: p.direction ?? existing.direction,
    priority: p.priority ?? existing.priority,
    action: p.action ?? existing.action,
    rules: p.rules ?? existing.rules,
    urlRules: p.urlRules !== undefined ? p.urlRules : existing.urlRules,
    notifySender: p.notifySender ?? existing.notifySender,
    notifyRecipient: p.notifyRecipient ?? existing.notifyRecipient,
    notifyAdminEmail: p.notifyAdminEmail !== undefined ? p.notifyAdminEmail : existing.notifyAdminEmail,
  };

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, policyId)
    .input("name", sql.NVarChar, merged.name)
    .input("description", sql.NVarChar, merged.description)
    .input("enabled", sql.Bit, merged.enabled)
    .input("mandatory", sql.Bit, merged.mandatory)
    .input("direction", sql.VarChar, merged.direction)
    .input("priority", sql.Int, merged.priority)
    .input("action", sql.VarChar, merged.action)
    .input("rulesJson", sql.NVarChar(sql.MAX), JSON.stringify(merged.rules))
    .input("urlPatternsJson", sql.NVarChar(sql.MAX), merged.urlRules ? JSON.stringify(merged.urlRules) : null)
    .input("notifySender", sql.Bit, merged.notifySender)
    .input("notifyRecipient", sql.Bit, merged.notifyRecipient)
    .input("notifyAdminEmail", sql.NVarChar, merged.notifyAdminEmail)
    .input("updatedByUserId", sql.Int, mail.userId)
    .query(`
      UPDATE MailBlockingPolicies SET
        Name = @name, Description = @description, Enabled = @enabled, Mandatory = @mandatory,
        Direction = @direction, Priority = @priority, Action = @action, RulesJson = @rulesJson,
        UrlPatternsJson = @urlPatternsJson, NotifySender = @notifySender, NotifyRecipient = @notifyRecipient,
        NotifyAdminEmail = @notifyAdminEmail, UpdatedByUserId = @updatedByUserId, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  if (p.scopes) {
    await db.request().input("id", sql.Int, policyId).query("DELETE FROM MailPolicyScopes WHERE PolicyId = @id");
    for (const scope of p.scopes) {
      await db
        .request()
        .input("policyId", sql.Int, policyId)
        .input("scopeType", sql.VarChar, scope.scopeType)
        .input("scopeValue", sql.NVarChar, scope.scopeValue ?? null)
        .query("INSERT INTO MailPolicyScopes (PolicyId, ScopeType, ScopeValue) VALUES (@policyId, @scopeType, @scopeValue)");
    }
  }

  await logAdminAction({ admin: mail, section: "mail-security", action: "policy_update", details: merged.name, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_policy_delete");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const policyId = Number(id);
  const existing = await loadPolicyById(policyId);
  if (!existing) return NextResponse.json({ ok: false, error: "Policy not found" }, { status: 404 });

  const db = await getDb();
  await db.request().input("id", sql.Int, policyId).query("UPDATE MailBlockingPolicies SET DeletedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin: mail, section: "mail-security", action: "policy_delete", details: existing.name, req });

  return NextResponse.json({ ok: true });
}
