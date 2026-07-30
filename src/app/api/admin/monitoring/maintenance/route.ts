import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { createMaintenanceWindowSchema } from "@/lib/websiteApiMonitoring/schema";

export async function GET() {
  const mon = await requireMonitoringPermission("mon_view");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const windows = await db.query(`
    SELECT Id, Name, Description, CONVERT(VARCHAR(33), StartsAt, 126) AS StartsAt, CONVERT(VARCHAR(33), EndsAt, 126) AS EndsAt,
      IsRecurring, RecurrenceRule, IsActive
    FROM MaintenanceWindows ORDER BY StartsAt DESC
  `);
  const monitors = await db.query<{ MaintenanceWindowId: number; MonitorId: number }>("SELECT MaintenanceWindowId, MonitorId FROM MaintenanceWindowMonitors");

  const data = windows.recordset.map((w: { Id: number } & Record<string, unknown>) => ({
    ...w,
    monitorIds: monitors.recordset.filter((m) => m.MaintenanceWindowId === w.Id).map((m) => m.MonitorId),
  }));

  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_maintenance_manage");
  if (!isMonitoringSession(mon)) return mon;

  const body = await req.json().catch(() => null);
  const parsed = createMaintenanceWindowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid maintenance window payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const inserted = await db
    .request()
    .input("name", sql.NVarChar, p.name)
    .input("description", sql.NVarChar, p.description ?? null)
    .input("startsAt", sql.DateTime2, p.startsAt)
    .input("endsAt", sql.DateTime2, p.endsAt)
    .input("isRecurring", sql.Bit, p.isRecurring)
    .input("recurrenceRule", sql.VarChar, p.recurrenceRule ?? null)
    .input("isActive", sql.Bit, p.isActive)
    .input("createdByUserId", sql.Int, mon.userId)
    .query<{ Id: number }>(`
      INSERT INTO MaintenanceWindows (Name, Description, StartsAt, EndsAt, IsRecurring, RecurrenceRule, IsActive, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @description, @startsAt, @endsAt, @isRecurring, @recurrenceRule, @isActive, @createdByUserId)
    `);
  const windowId = inserted.recordset[0].Id;

  for (const monitorId of p.monitorIds) {
    await db
      .request()
      .input("windowId", sql.Int, windowId)
      .input("monitorId", sql.Int, monitorId)
      .query("INSERT INTO MaintenanceWindowMonitors (MaintenanceWindowId, MonitorId) VALUES (@windowId, @monitorId)");
  }

  await logAdminAction({ admin: mon, section: "monitoring", action: "maintenance_window_create", details: p.name, req });

  return NextResponse.json({ ok: true, data: { id: windowId } });
}
