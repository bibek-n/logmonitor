import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { updateMaintenanceWindowSchema } from "@/lib/websiteApiMonitoring/schema";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_maintenance_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateMaintenanceWindowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid maintenance window payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, Number(id))
    .query<{ Name: string; Description: string | null; StartsAt: string; EndsAt: string; IsRecurring: boolean; RecurrenceRule: string | null; IsActive: boolean }>(
      "SELECT Name, Description, CONVERT(VARCHAR(33), StartsAt, 126) AS StartsAt, CONVERT(VARCHAR(33), EndsAt, 126) AS EndsAt, IsRecurring, RecurrenceRule, IsActive FROM MaintenanceWindows WHERE Id = @id"
    );
  const existingRow = existing.recordset[0];
  if (!existingRow) return NextResponse.json({ ok: false, error: "Maintenance window not found" }, { status: 404 });

  const merged = {
    name: p.name ?? existingRow.Name,
    description: p.description !== undefined ? p.description : existingRow.Description,
    startsAt: p.startsAt ?? new Date(existingRow.StartsAt),
    endsAt: p.endsAt ?? new Date(existingRow.EndsAt),
    isRecurring: p.isRecurring ?? existingRow.IsRecurring,
    recurrenceRule: p.recurrenceRule !== undefined ? p.recurrenceRule : existingRow.RecurrenceRule,
    isActive: p.isActive ?? existingRow.IsActive,
  };

  await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("name", sql.NVarChar, merged.name)
    .input("description", sql.NVarChar, merged.description)
    .input("startsAt", sql.DateTime2, merged.startsAt)
    .input("endsAt", sql.DateTime2, merged.endsAt)
    .input("isRecurring", sql.Bit, merged.isRecurring)
    .input("recurrenceRule", sql.VarChar, merged.recurrenceRule)
    .input("isActive", sql.Bit, merged.isActive)
    .query(
      "UPDATE MaintenanceWindows SET Name=@name, Description=@description, StartsAt=@startsAt, EndsAt=@endsAt, IsRecurring=@isRecurring, RecurrenceRule=@recurrenceRule, IsActive=@isActive WHERE Id=@id"
    );

  if (p.monitorIds) {
    await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM MaintenanceWindowMonitors WHERE MaintenanceWindowId = @id");
    for (const monitorId of p.monitorIds) {
      await db
        .request()
        .input("windowId", sql.Int, Number(id))
        .input("monitorId", sql.Int, monitorId)
        .query("INSERT INTO MaintenanceWindowMonitors (MaintenanceWindowId, MonitorId) VALUES (@windowId, @monitorId)");
    }
  }

  await logAdminAction({ admin: mon, section: "monitoring", action: "maintenance_window_update", details: merged.name, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_maintenance_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, Number(id)).query<{ Name: string }>("SELECT Name FROM MaintenanceWindows WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Maintenance window not found" }, { status: 404 });

  await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM MaintenanceWindows WHERE Id = @id");

  await logAdminAction({ admin: mon, section: "monitoring", action: "maintenance_window_delete", details: existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}
