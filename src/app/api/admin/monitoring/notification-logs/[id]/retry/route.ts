import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { retryNotificationNow } from "@/lib/websiteApiMonitoring/notificationRetry";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_alert_contacts_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const result = await retryNotificationNow(Number(id));
  if (!result) {
    return NextResponse.json({ ok: false, error: "This notification can't be retried (no saved alert contact, or no message body was recorded)." }, { status: 400 });
  }

  await logAdminAction({ admin: mon, section: "monitoring", action: "notification_retry", details: `NotificationLogs #${id}`, req });

  return NextResponse.json({ ok: true, data: result });
}
