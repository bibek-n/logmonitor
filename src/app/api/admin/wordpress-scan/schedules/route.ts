import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { listSchedules, upsertSchedule, isRecurrence } from "@/lib/wordpressScan/schedules";
import { isScanProfile } from "@/lib/wordpressScan/shared";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const data = await listSchedules();
  return NextResponse.json({ ok: true, data });
}

// Upsert — one schedule per website. Body: { websiteId, recurrence, profile, isActive }.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const websiteId = Number(body?.websiteId);
  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });
  }
  if (!isRecurrence(body?.recurrence)) {
    return NextResponse.json({ ok: false, error: "Invalid recurrence." }, { status: 400 });
  }
  const profile = isScanProfile(body?.profile) ? body.profile : "standard";
  const isActive = body?.isActive !== false;

  await upsertSchedule(websiteId, body.recurrence, profile, isActive, admin);
  await logAdminAction({ admin, section: "wordpress-scan", action: "schedule_upsert", details: `website #${websiteId}: ${body.recurrence}/${profile}`, req });

  return NextResponse.json({ ok: true });
}
