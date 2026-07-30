import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { sendNotificationEmail } from "@/lib/notifyEmail";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { sendMonitorReportSchema } from "@/lib/websiteApiMonitoring/schema";
import { listWebsiteMonitorsForReport } from "@/lib/websiteApiMonitoring/repository";
import { buildMonitorReportEmail } from "@/lib/websiteApiMonitoring/reportEmail";

interface ContactRow {
  Id: number;
  Destination: string;
}

// On-demand "send me the current status of every website monitor" report - distinct from
// notifications.ts's sendMonitoringAlert (which fires automatically on Down/Recovery/SSL
// events for a single monitor). Recipients can be existing Email alert contacts, ad-hoc
// addresses typed in for this send only, or both - never all contacts implicitly.
export async function POST(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_reports_view");
  if (!isMonitoringSession(mon)) return mon;

  const body = await req.json().catch(() => null);
  const parsed = sendMonitorReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid report request" }, { status: 400 });
  }
  const { contactIds, emails } = parsed.data;

  const db = await getDb();

  let contacts: ContactRow[] = [];
  if (contactIds.length > 0) {
    const idParams = contactIds.map((_, i) => `@id${i}`).join(",");
    const request = db.request();
    contactIds.forEach((id, i) => request.input(`id${i}`, sql.Int, id));
    const result = await request.query<ContactRow>(
      `SELECT Id, Destination FROM AlertContacts WHERE ContactType = 'Email' AND IsActive = 1 AND Id IN (${idParams})`
    );
    contacts = result.recordset;
  }

  const adHocEmails = [...new Set(emails.map((e) => e.toLowerCase()))];
  const contactEmails = new Set(contacts.map((c) => c.Destination.toLowerCase()));
  const uniqueAdHoc = adHocEmails.filter((e) => !contactEmails.has(e));

  const recipients = [...contacts.map((c) => c.Destination), ...uniqueAdHoc];
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "None of the selected recipients could be resolved to an active email address." }, { status: 400 });
  }

  const rows = await listWebsiteMonitorsForReport();
  const generatedAt = new Date();
  const { subject, body: emailBody } = buildMonitorReportEmail(rows, generatedAt);

  const sendResult = await sendNotificationEmail({ to: recipients.join(","), subject, body: emailBody });
  const status = sendResult.success ? "Sent" : "Failed";
  const sentAt = sendResult.success ? generatedAt : null;

  for (const contact of contacts) {
    await db
      .request()
      .input("eventType", sql.VarChar, "ManualReport")
      .input("subject", sql.NVarChar, subject)
      .input("contactId", sql.Int, contact.Id)
      .input("status", sql.VarChar, status)
      .input("sentAt", sql.DateTime2, sentAt)
      .input("failureReason", sql.NVarChar, sendResult.error ?? null)
      .query(
        `INSERT INTO NotificationLogs (EventType, Subject, AlertContactId, Provider, Status, SentAt, FailureReason)
         VALUES (@eventType, @subject, @contactId, 'Email', @status, @sentAt, @failureReason)`
      );
  }
  for (let i = 0; i < uniqueAdHoc.length; i++) {
    await db
      .request()
      .input("eventType", sql.VarChar, "ManualReport")
      .input("subject", sql.NVarChar, subject)
      .input("status", sql.VarChar, status)
      .input("sentAt", sql.DateTime2, sentAt)
      .input("failureReason", sql.NVarChar, sendResult.error ?? null)
      .query(
        `INSERT INTO NotificationLogs (EventType, Subject, Provider, Status, SentAt, FailureReason)
         VALUES (@eventType, @subject, 'Email', @status, @sentAt, @failureReason)`
      );
  }

  await logAdminAction({
    admin: mon,
    section: "monitoring",
    action: "website_monitor_report_sent",
    details: `Report (${rows.length} monitors) sent to ${recipients.length} recipient(s): ${recipients.join(", ")}`,
    req,
  });

  return NextResponse.json({ ok: true, data: { recipientCount: recipients.length, success: sendResult.success, error: sendResult.error } });
}
