import "dotenv/config";
import { getDb, sql } from "../src/lib/db";
import { sendNotificationEmail, EmailAttachment } from "../src/lib/notifyEmail";
import { listWebsiteMonitorsForReport, listApiMonitorsForReport, WebsiteMonitorReportRow } from "../src/lib/websiteApiMonitoring/repository";
import { buildMonitorReportEmail } from "../src/lib/websiteApiMonitoring/reportEmail";
import { buildReportCsv, buildReportExcel, buildReportPdf } from "../src/lib/websiteApiMonitoring/reportExport";

interface DueReportRow {
  Id: number;
  Name: string;
  Frequency: "Daily" | "Weekly" | "Monthly";
  Format: "Email" | "Csv" | "Pdf" | "Excel";
  MonitorScope: "All" | "Selected";
  RecipientEmails: string | null;
}

function computeNextSendAt(frequency: DueReportRow["Frequency"], from: Date): Date {
  const next = new Date(from);
  if (frequency === "Daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === "Weekly") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

async function buildAttachment(format: DueReportRow["Format"], rows: WebsiteMonitorReportRow[], generatedAt: Date, reportName: string): Promise<EmailAttachment | null> {
  const dateStr = generatedAt.toISOString().slice(0, 10);
  if (format === "Csv") return { filename: `${reportName}-${dateStr}.csv`, content: Buffer.from(buildReportCsv(rows), "utf8"), contentType: "text/csv" };
  if (format === "Excel") return { filename: `${reportName}-${dateStr}.xlsx`, content: await buildReportExcel(rows), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  if (format === "Pdf") return { filename: `${reportName}-${dateStr}.pdf`, content: await buildReportPdf(rows, generatedAt, reportName), contentType: "application/pdf" };
  return null; // Email format - body text only, no attachment, matching the existing on-demand report
}

async function processReport(report: DueReportRow): Promise<void> {
  const db = await getDb();

  const contactEmails = await db
    .request()
    .input("id", sql.Int, report.Id)
    .query<{ Destination: string }>(`
      SELECT ac.Destination FROM ScheduledReportContacts src JOIN AlertContacts ac ON ac.Id = src.AlertContactId
      WHERE src.ScheduledReportId = @id AND ac.ContactType = 'Email' AND ac.IsActive = 1
    `);
  const adHoc = (report.RecipientEmails ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  const recipients = [...new Set([...contactEmails.recordset.map((r) => r.Destination), ...adHoc].map((e) => e.toLowerCase()))];

  if (recipients.length === 0) {
    console.warn(`Scheduled report "${report.Name}" (#${report.Id}) has no resolvable recipients - skipping this send, will retry next scheduled time.`);
    return;
  }

  const [websiteRows, apiRows] = await Promise.all([listWebsiteMonitorsForReport(), listApiMonitorsForReport()]);
  let rows = [...websiteRows, ...apiRows];

  if (report.MonitorScope === "Selected") {
    const selected = await db.request().input("id", sql.Int, report.Id).query<{ MonitorId: number }>("SELECT MonitorId FROM ScheduledReportMonitors WHERE ScheduledReportId = @id");
    const selectedIds = new Set(selected.recordset.map((r) => r.MonitorId));
    rows = rows.filter((r) => selectedIds.has(r.id));
  }

  const generatedAt = new Date();
  const { subject, body } = buildMonitorReportEmail(rows, generatedAt);
  const attachment = await buildAttachment(report.Format, rows, generatedAt, report.Name.replace(/[^a-z0-9-]+/gi, "-"));

  const result = await sendNotificationEmail({ to: recipients.join(","), subject: `[Scheduled] ${subject}`, body, attachments: attachment ? [attachment] : undefined });

  await db
    .request()
    .input("subject", sql.NVarChar, subject)
    .input("body", sql.NVarChar(sql.MAX), body)
    .input("status", sql.VarChar, result.success ? "Sent" : "Failed")
    .input("sentAt", sql.DateTime2, result.success ? generatedAt : null)
    .input("failureReason", sql.NVarChar, result.error ?? (result.success ? null : `${recipients.length} recipient(s)`))
    .query(`
      INSERT INTO NotificationLogs (EventType, Subject, Body, Provider, Status, SentAt, FailureReason)
      VALUES ('ScheduledReport', @subject, @body, 'Email', @status, @sentAt, @failureReason)
    `);

  const nextSendAt = computeNextSendAt(report.Frequency, generatedAt);
  await db
    .request()
    .input("id", sql.Int, report.Id)
    .input("lastSentAt", sql.DateTime2, generatedAt)
    .input("nextSendAt", sql.DateTime2, nextSendAt)
    .query("UPDATE ScheduledReports SET LastSentAt = @lastSentAt, NextSendAt = @nextSendAt WHERE Id = @id");

  console.log(`Scheduled report "${report.Name}" (#${report.Id}): ${result.success ? "sent" : "FAILED"} to ${recipients.length} recipient(s). Next send: ${nextSendAt.toISOString()}`);
}

async function main() {
  const db = await getDb();
  const due = await db.query<DueReportRow>("SELECT Id, Name, Frequency, Format, MonitorScope, RecipientEmails FROM ScheduledReports WHERE IsActive = 1 AND NextSendAt <= SYSUTCDATETIME()");
  console.log(`Scheduled Reports: ${due.recordset.length} report(s) due.`);

  for (const report of due.recordset) {
    try {
      await processReport(report);
    } catch (err) {
      console.error(`Failed to process scheduled report ${report.Id} (${report.Name}):`, err instanceof Error ? err.message : err);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
