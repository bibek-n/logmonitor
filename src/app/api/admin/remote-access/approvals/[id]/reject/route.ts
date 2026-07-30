import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { getApprovalRequest, reviewApprovalRequest } from "@/lib/remoteAccess/repository";

const rejectSchema = z.object({ note: z.string().trim().max(500).optional().nullable() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_bulk_execute");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const approval = await getApprovalRequest(Number(id));
  if (!approval || approval.status !== "Pending") {
    return NextResponse.json({ ok: false, error: "Approval request not found or already reviewed" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = rejectSchema.safeParse(body);
  await reviewApprovalRequest(Number(id), "Rejected", ra.userId, ra.username, parsed.success ? parsed.data.note ?? null : null);
  await logAdminAction({ admin: ra, section: "remote-access", action: "approval_reject", details: `#${id}: ${approval.summary}`, req });
  return NextResponse.json({ ok: true });
}
