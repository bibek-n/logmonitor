import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { updateFindingStatus, isFindingStatus } from "@/lib/wordpressScan/findings";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const findingId = Number(id);
  if (!Number.isInteger(findingId) || findingId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid finding id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!isFindingStatus(body?.status)) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;

  const found = await updateFindingStatus(findingId, body.status, reason, admin);
  if (!found) return NextResponse.json({ ok: false, error: "Finding not found." }, { status: 404 });

  await logAdminAction({ admin, section: "wordpress-scan", action: "finding_status_update", details: `#${findingId} -> ${body.status}`, req });

  return NextResponse.json({ ok: true });
}
