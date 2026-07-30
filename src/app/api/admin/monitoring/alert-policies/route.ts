import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { createAlertPolicySchema } from "@/lib/websiteApiMonitoring/schema";
import { insertEscalationSteps } from "@/lib/websiteApiMonitoring/alertPolicySteps";

export async function GET() {
  const mon = await requireMonitoringPermission("mon_alert_contacts_view");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const policies = await db.query(`
    SELECT Id, Name, IsDefault, NotifyOnDown, NotifyOnRecovery, NotifyOnDegraded, NotifyOnSslExpiring,
      QuietHoursEnabled, QuietHoursStart, QuietHoursEnd, QuietHoursTimezone, QuietHoursAllowCritical, EscalationEnabled
    FROM AlertPolicies ORDER BY IsDefault DESC, Name ASC
  `);
  const contacts = await db.query<{ AlertPolicyId: number; AlertContactId: number }>("SELECT AlertPolicyId, AlertContactId FROM AlertPolicyContacts");
  const steps = await db.query<{ Id: number; AlertPolicyId: number; StepOrder: number; DelayMinutes: number }>(
    "SELECT Id, AlertPolicyId, StepOrder, DelayMinutes FROM AlertEscalationSteps ORDER BY StepOrder ASC"
  );
  const stepContacts = await db.query<{ StepId: number; AlertContactId: number }>("SELECT StepId, AlertContactId FROM AlertEscalationStepContacts");

  const data = policies.recordset.map((p: { Id: number } & Record<string, unknown>) => ({
    ...p,
    contactIds: contacts.recordset.filter((c) => c.AlertPolicyId === p.Id).map((c) => c.AlertContactId),
    escalationSteps: steps.recordset
      .filter((s) => s.AlertPolicyId === p.Id)
      .map((s) => ({
        delayMinutes: s.DelayMinutes,
        contactIds: stepContacts.recordset.filter((sc) => sc.StepId === s.Id).map((sc) => sc.AlertContactId),
      })),
  }));

  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_alert_policies_manage");
  if (!isMonitoringSession(mon)) return mon;

  const body = await req.json().catch(() => null);
  const parsed = createAlertPolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid alert policy payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  if (p.isDefault) {
    await db.query("UPDATE AlertPolicies SET IsDefault = 0");
  }

  const inserted = await db
    .request()
    .input("name", sql.NVarChar, p.name)
    .input("isDefault", sql.Bit, p.isDefault)
    .input("notifyOnDown", sql.Bit, p.notifyOnDown)
    .input("notifyOnRecovery", sql.Bit, p.notifyOnRecovery)
    .input("notifyOnDegraded", sql.Bit, p.notifyOnDegraded)
    .input("notifyOnSslExpiring", sql.Bit, p.notifyOnSslExpiring)
    .input("quietHoursEnabled", sql.Bit, p.quietHoursEnabled)
    .input("quietHoursStart", sql.VarChar, p.quietHoursStart ?? null)
    .input("quietHoursEnd", sql.VarChar, p.quietHoursEnd ?? null)
    .input("quietHoursTimezone", sql.VarChar, p.quietHoursTimezone)
    .input("quietHoursAllowCritical", sql.Bit, p.quietHoursAllowCritical)
    .input("escalationEnabled", sql.Bit, p.escalationEnabled)
    .query<{ Id: number }>(`
      INSERT INTO AlertPolicies (Name, IsDefault, NotifyOnDown, NotifyOnRecovery, NotifyOnDegraded, NotifyOnSslExpiring,
        QuietHoursEnabled, QuietHoursStart, QuietHoursEnd, QuietHoursTimezone, QuietHoursAllowCritical, EscalationEnabled)
      OUTPUT INSERTED.Id
      VALUES (@name, @isDefault, @notifyOnDown, @notifyOnRecovery, @notifyOnDegraded, @notifyOnSslExpiring,
        @quietHoursEnabled, @quietHoursStart, @quietHoursEnd, @quietHoursTimezone, @quietHoursAllowCritical, @escalationEnabled)
    `);
  const policyId = inserted.recordset[0].Id;

  for (const contactId of p.contactIds) {
    await db.request().input("policyId", sql.Int, policyId).input("contactId", sql.Int, contactId).query("INSERT INTO AlertPolicyContacts (AlertPolicyId, AlertContactId) VALUES (@policyId, @contactId)");
  }
  await insertEscalationSteps(policyId, p.escalationSteps);

  await logAdminAction({ admin: mon, section: "monitoring", action: "alert_policy_create", details: p.name, req });

  return NextResponse.json({ ok: true, data: { id: policyId } });
}
