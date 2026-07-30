import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { updateScheduledReportSchema } from "@/lib/websiteApiMonitoring/schema";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_reports_view");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateScheduledReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid scheduled report payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, Number(id)).query<{ Name: string }>("SELECT Name FROM ScheduledReports WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Scheduled report not found" }, { status: 404 });

  await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("name", sql.NVarChar, p.name ?? existing.recordset[0].Name)
    .input("frequency", sql.VarChar, p.frequency)
    .input("format", sql.VarChar, p.format)
    .input("monitorScope", sql.VarChar, p.monitorScope)
    .input("recipientEmails", sql.NVarChar, p.recipientEmails)
    .input("isActive", sql.Bit, p.isActive)
    .query(`
      UPDATE ScheduledReports SET Name = @name,
        Frequency = COALESCE(@frequency, Frequency),
        Format = COALESCE(@format, Format),
        MonitorScope = COALESCE(@monitorScope, MonitorScope),
        RecipientEmails = CASE WHEN @recipientEmails IS NOT NULL THEN @recipientEmails ELSE RecipientEmails END,
        IsActive = COALESCE(@isActive, IsActive)
      WHERE Id = @id
    `);

  if (p.contactIds) {
    await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM ScheduledReportContacts WHERE ScheduledReportId = @id");
    for (const contactId of p.contactIds) {
      await db.request().input("r", sql.Int, Number(id)).input("c", sql.Int, contactId).query("INSERT INTO ScheduledReportContacts (ScheduledReportId, AlertContactId) VALUES (@r, @c)");
    }
  }
  if (p.monitorIds) {
    await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM ScheduledReportMonitors WHERE ScheduledReportId = @id");
    for (const monitorId of p.monitorIds) {
      await db.request().input("r", sql.Int, Number(id)).input("m", sql.Int, monitorId).query("INSERT INTO ScheduledReportMonitors (ScheduledReportId, MonitorId) VALUES (@r, @m)");
    }
  }

  await logAdminAction({ admin: mon, section: "monitoring", action: "scheduled_report_update", details: p.name ?? existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_reports_view");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, Number(id)).query<{ Name: string }>("SELECT Name FROM ScheduledReports WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Scheduled report not found" }, { status: 404 });

  await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM ScheduledReports WHERE Id = @id");

  await logAdminAction({ admin: mon, section: "monitoring", action: "scheduled_report_delete", details: existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}
