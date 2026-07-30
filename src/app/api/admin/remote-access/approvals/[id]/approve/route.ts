import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { getApprovalRequest, reviewApprovalRequest } from "@/lib/remoteAccess/repository";
import { runScript } from "@/lib/remoteAccess/scriptExecutionService";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_bulk_execute");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const approval = await getApprovalRequest(Number(id));
  if (!approval || approval.status !== "Pending") {
    return NextResponse.json({ ok: false, error: "Approval request not found or already reviewed" }, { status: 404 });
  }
  // A second admin must approve - the requester cannot approve their own bulk-execution request.
  if (approval.requestedByUserId === ra.userId) {
    return NextResponse.json({ ok: false, error: "You cannot approve your own request - ask another admin to review it." }, { status: 403 });
  }

  await reviewApprovalRequest(Number(id), "Approved", ra.userId, ra.username, null);

  if (approval.actionType === "BulkScriptExecution") {
    const payload = JSON.parse(approval.payload) as { scriptId: number; connectionIds: number[] };
    const { batchId, results } = await runScript(payload.scriptId, payload.connectionIds, approval.requestedByUserId, approval.requestedByUsername);
    await logAdminAction({ admin: ra, section: "remote-access", action: "approval_approve", details: `#${id}: ${approval.summary}`, req });
    return NextResponse.json({ ok: true, data: { batchId, results } });
  }

  return NextResponse.json({ ok: true });
}
