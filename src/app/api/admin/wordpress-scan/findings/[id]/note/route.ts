import { NextRequest, NextResponse } from "next/server";
import { requireWordpressScanPermission, isWordpressScanSession } from "@/lib/requireWordpressScanPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { updateFindingNote } from "@/lib/wordpressScan/findings";

// Deliberately gated on wps_scan (not requireAdmin like the status PATCH) — this lets a
// view+scan-only Security Auditor record why a finding can't be fixed, without granting
// any status-change rights.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireWordpressScanPermission("wps_scan");
  if (!isWordpressScanSession(admin)) return admin;

  const { id } = await params;
  const findingId = Number(id);
  if (!Number.isInteger(findingId) || findingId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid finding id." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.note !== "string" && body?.note !== null) {
    return NextResponse.json({ ok: false, error: "Invalid note." }, { status: 400 });
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null;

  const found = await updateFindingNote(findingId, note);
  if (!found) return NextResponse.json({ ok: false, error: "Finding not found." }, { status: 404 });

  await logAdminAction({ admin, section: "wordpress-scan", action: "finding_note_update", details: `#${findingId}`, req });

  return NextResponse.json({ ok: true });
}
