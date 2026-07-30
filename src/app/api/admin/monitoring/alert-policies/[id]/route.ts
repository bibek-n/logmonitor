import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { updateAlertPolicySchema } from "@/lib/websiteApiMonitoring/schema";
import { insertEscalationSteps } from "@/lib/websiteApiMonitoring/alertPolicySteps";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_alert_policies_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateAlertPolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid alert policy payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, Number(id)).query<{ Name: string }>("SELECT Name FROM AlertPolicies WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Alert policy not found" }, { status: 404 });

  if (p.isDefault) {
    await db.query("UPDATE AlertPolicies SET IsDefault = 0");
  }

  await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("name", sql.NVarChar, p.name ?? existing.recordset[0].Name)
    .input("isDefault", sql.Bit, p.isDefault ?? false)
    .input("notifyOnDown", sql.Bit, p.notifyOnDown)
    .input("notifyOnRecovery", sql.Bit, p.notifyOnRecovery)
    .input("notifyOnDegraded", sql.Bit, p.notifyOnDegraded)
    .input("notifyOnSslExpiring", sql.Bit, p.notifyOnSslExpiring)
    .input("quietHoursEnabled", sql.Bit, p.quietHoursEnabled)
    .input("quietHoursStart", sql.VarChar, p.quietHoursStart)
    .input("quietHoursEnd", sql.VarChar, p.quietHoursEnd)
    .input("quietHoursTimezone", sql.VarChar, p.quietHoursTimezone)
    .input("quietHoursAllowCritical", sql.Bit, p.quietHoursAllowCritical)
    .input("escalationEnabled", sql.Bit, p.escalationEnabled)
    .query(`
      UPDATE AlertPolicies SET Name = @name,
        IsDefault = CASE WHEN @isDefault = 1 THEN 1 ELSE IsDefault END,
        NotifyOnDown = COALESCE(@notifyOnDown, NotifyOnDown),
        NotifyOnRecovery = COALESCE(@notifyOnRecovery, NotifyOnRecovery),
        NotifyOnDegraded = COALESCE(@notifyOnDegraded, NotifyOnDegraded),
        NotifyOnSslExpiring = COALESCE(@notifyOnSslExpiring, NotifyOnSslExpiring),
        QuietHoursEnabled = COALESCE(@quietHoursEnabled, QuietHoursEnabled),
        QuietHoursStart = CASE WHEN @quietHoursStart IS NOT NULL THEN @quietHoursStart ELSE QuietHoursStart END,
        QuietHoursEnd = CASE WHEN @quietHoursEnd IS NOT NULL THEN @quietHoursEnd ELSE QuietHoursEnd END,
        QuietHoursTimezone = COALESCE(@quietHoursTimezone, QuietHoursTimezone),
        QuietHoursAllowCritical = COALESCE(@quietHoursAllowCritical, QuietHoursAllowCritical),
        EscalationEnabled = COALESCE(@escalationEnabled, EscalationEnabled)
      WHERE Id = @id
    `);

  if (p.contactIds) {
    await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM AlertPolicyContacts WHERE AlertPolicyId = @id");
    for (const contactId of p.contactIds) {
      await db
        .request()
        .input("policyId", sql.Int, Number(id))
        .input("contactId", sql.Int, contactId)
        .query("INSERT INTO AlertPolicyContacts (AlertPolicyId, AlertContactId) VALUES (@policyId, @contactId)");
    }
  }

  if (p.escalationSteps) {
    // ON DELETE CASCADE from AlertEscalationSteps takes AlertEscalationStepContacts and
    // IncidentEscalations (any already-fired step markers) down with it - a step-list edit
    // resets which steps have "already fired" for any currently-open incident, same as
    // recreating the schedule from scratch.
    await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM AlertEscalationSteps WHERE AlertPolicyId = @id");
    await insertEscalationSteps(Number(id), p.escalationSteps);
  }

  await logAdminAction({ admin: mon, section: "monitoring", action: "alert_policy_update", details: p.name ?? existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_alert_policies_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, Number(id)).query<{ Name: string; IsDefault: boolean }>("SELECT Name, IsDefault FROM AlertPolicies WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Alert policy not found" }, { status: 404 });
  if (existing.recordset[0].IsDefault) {
    return NextResponse.json({ ok: false, error: "Cannot delete the default alert policy. Make another policy the default first." }, { status: 400 });
  }

  await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM AlertPolicies WHERE Id = @id");

  await logAdminAction({ admin: mon, section: "monitoring", action: "alert_policy_delete", details: existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}
