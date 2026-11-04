import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { deleteSchedule } from "@/lib/wordpressScan/schedules";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ websiteId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { websiteId } = await params;
  const id = Number(websiteId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid websiteId." }, { status: 400 });
  }

  await deleteSchedule(id);
  await logAdminAction({ admin, section: "wordpress-scan", action: "schedule_delete", details: `website #${id}`, req });

  return NextResponse.json({ ok: true });
}
