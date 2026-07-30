import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { upsertSlaConfigSchema } from "@/lib/websiteApiMonitoring/schema";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ monitorId: string }> }) {
  const mon = await requireMonitoringPermission("mon_settings_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { monitorId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = upsertSlaConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid SLA payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const monitor = await db.request().input("id", sql.Int, Number(monitorId)).query<{ Name: string }>("SELECT Name FROM Monitors WHERE Id = @id AND IsDeleted = 0");
  if (!monitor.recordset[0]) return NextResponse.json({ ok: false, error: "Monitor not found" }, { status: 404 });

  await db
    .request()
    .input("monitorId", sql.Int, Number(monitorId))
    .input("targetPercent", sql.Decimal(5, 2), p.targetPercent)
    .input("evaluationWindow", sql.VarChar, p.evaluationWindow)
    .query(`
      MERGE SlaConfigurations AS target
      USING (SELECT @monitorId AS MonitorId) AS src ON target.MonitorId = src.MonitorId
      WHEN MATCHED THEN UPDATE SET TargetPercent = @targetPercent, EvaluationWindow = @evaluationWindow
      WHEN NOT MATCHED THEN INSERT (MonitorId, TargetPercent, EvaluationWindow) VALUES (@monitorId, @targetPercent, @evaluationWindow);
    `);

  await logAdminAction({ admin: mon, section: "monitoring", action: "sla_config_upsert", details: `${monitor.recordset[0].Name}: ${p.targetPercent}% ${p.evaluationWindow}`, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ monitorId: string }> }) {
  const mon = await requireMonitoringPermission("mon_settings_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { monitorId } = await params;
  const db = await getDb();
  await db.request().input("id", sql.Int, Number(monitorId)).query("DELETE FROM SlaConfigurations WHERE MonitorId = @id");

  await logAdminAction({ admin: mon, section: "monitoring", action: "sla_config_remove", details: `Monitor #${monitorId}`, req });

  return NextResponse.json({ ok: true });
}
