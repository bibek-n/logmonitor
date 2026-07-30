import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { createScheduledReportSchema } from "@/lib/websiteApiMonitoring/schema";

export async function GET() {
  const mon = await requireMonitoringPermission("mon_reports_view");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const reports = await db.query(`
    SELECT Id, Name, Frequency, Format, MonitorScope, RecipientEmails, IsActive,
      CONVERT(VARCHAR(33), LastSentAt, 126) AS LastSentAt, CONVERT(VARCHAR(33), NextSendAt, 126) AS NextSendAt
    FROM ScheduledReports ORDER BY Name ASC
  `);
  const contacts = await db.query<{ ScheduledReportId: number; AlertContactId: number }>("SELECT ScheduledReportId, AlertContactId FROM ScheduledReportContacts");
  const monitors = await db.query<{ ScheduledReportId: number; MonitorId: number }>("SELECT ScheduledReportId, MonitorId FROM ScheduledReportMonitors");

  const data = reports.recordset.map((r: { Id: number } & Record<string, unknown>) => ({
    ...r,
    contactIds: contacts.recordset.filter((c) => c.ScheduledReportId === r.Id).map((c) => c.AlertContactId),
    monitorIds: monitors.recordset.filter((m) => m.ScheduledReportId === r.Id).map((m) => m.MonitorId),
  }));

  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_reports_view");
  if (!isMonitoringSession(mon)) return mon;

  const body = await req.json().catch(() => null);
  const parsed = createScheduledReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid scheduled report payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const inserted = await db
    .request()
    .input("name", sql.NVarChar, p.name)
    .input("frequency", sql.VarChar, p.frequency)
    .input("format", sql.VarChar, p.format)
    .input("monitorScope", sql.VarChar, p.monitorScope)
    .input("recipientEmails", sql.NVarChar, p.recipientEmails ?? null)
    .input("isActive", sql.Bit, p.isActive)
    .input("createdByUserId", sql.Int, mon.userId)
    .query<{ Id: number }>(`
      INSERT INTO ScheduledReports (Name, Frequency, Format, MonitorScope, RecipientEmails, IsActive, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @frequency, @format, @monitorScope, @recipientEmails, @isActive, @createdByUserId)
    `);
  const reportId = inserted.recordset[0].Id;

  for (const contactId of p.contactIds) {
    await db.request().input("r", sql.Int, reportId).input("c", sql.Int, contactId).query("INSERT INTO ScheduledReportContacts (ScheduledReportId, AlertContactId) VALUES (@r, @c)");
  }
  if (p.monitorScope === "Selected") {
    for (const monitorId of p.monitorIds) {
      await db.request().input("r", sql.Int, reportId).input("m", sql.Int, monitorId).query("INSERT INTO ScheduledReportMonitors (ScheduledReportId, MonitorId) VALUES (@r, @m)");
    }
  }

  await logAdminAction({ admin: mon, section: "monitoring", action: "scheduled_report_create", details: p.name, req });

  return NextResponse.json({ ok: true, data: { id: reportId } });
}
