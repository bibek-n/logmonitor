import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { dispatchToContact } from "@/lib/websiteApiMonitoring/notifications";
import { AlertContactRow } from "@/lib/websiteApiMonitoring/notifications";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_alert_contacts_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, Number(id))
    .query<AlertContactRow>("SELECT Id, Destination, ContactType, ConfigJson FROM AlertContacts WHERE Id = @id");
  const contact = result.recordset[0];
  if (!contact) return NextResponse.json({ ok: false, error: "Alert contact not found" }, { status: 404 });

  const sendResult = await dispatchToContact(contact, {
    eventType: "Test",
    monitorId: 0,
    incidentId: null,
    subject: "Test notification - Website & API Monitoring",
    body: "This is a test notification from the Website & API Monitoring module. If you received this, your alert contact is configured correctly.",
  });

  if (sendResult.success) {
    await db.request().input("id", sql.Int, Number(id)).query("UPDATE AlertContacts SET VerificationStatus = 'Verified' WHERE Id = @id");
  }

  return NextResponse.json({ ok: true, data: sendResult });
}
