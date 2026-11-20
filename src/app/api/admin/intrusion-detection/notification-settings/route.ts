import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/intrusionDetection/notificationChannels";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const settings = await getNotificationSettings();
  return NextResponse.json({ ok: true, data: settings });
}

export async function PATCH(req: NextRequest) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });

  const patch: Parameters<typeof updateNotificationSettings>[0] = {};
  if ("quietHoursEnabled" in body) patch.quietHoursEnabled = Boolean(body.quietHoursEnabled);
  if ("quietHoursStart" in body) {
    if (body.quietHoursStart !== null && !HHMM.test(body.quietHoursStart)) return NextResponse.json({ ok: false, error: "quietHoursStart must be HH:MM." }, { status: 400 });
    patch.quietHoursStart = body.quietHoursStart;
  }
  if ("quietHoursEnd" in body) {
    if (body.quietHoursEnd !== null && !HHMM.test(body.quietHoursEnd)) return NextResponse.json({ ok: false, error: "quietHoursEnd must be HH:MM." }, { status: 400 });
    patch.quietHoursEnd = body.quietHoursEnd;
  }
  if ("quietHoursTimezone" in body) patch.quietHoursTimezone = String(body.quietHoursTimezone).slice(0, 50);
  if ("quietHoursAllowCritical" in body) patch.quietHoursAllowCritical = Boolean(body.quietHoursAllowCritical);
  if ("escalationEnabled" in body) patch.escalationEnabled = Boolean(body.escalationEnabled);
  if ("digestEnabled" in body) patch.digestEnabled = Boolean(body.digestEnabled);
  if ("digestHour" in body) {
    const h = Number(body.digestHour);
    if (!Number.isInteger(h) || h < 0 || h > 23) return NextResponse.json({ ok: false, error: "digestHour must be 0-23." }, { status: 400 });
    patch.digestHour = h;
  }
  if ("digestChannelId" in body) patch.digestChannelId = body.digestChannelId === null ? null : Number(body.digestChannelId);

  await updateNotificationSettings(patch);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "notification_settings_update", details: JSON.stringify(patch), req });

  const settings = await getNotificationSettings();
  return NextResponse.json({ ok: true, data: settings });
}
