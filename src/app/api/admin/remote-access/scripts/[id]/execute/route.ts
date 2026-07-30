import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { executeScriptSchema } from "@/lib/remoteAccess/schema";
import { runScript } from "@/lib/remoteAccess/scriptExecutionService";
import { createApprovalRequest, getScript, getSettings } from "@/lib/remoteAccess/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = executeScriptSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid execution request" }, { status: 400 });

  // Bulk execution (more than one target connection) requires the ra_bulk_execute permission in
  // addition to ra_scripts_execute - a single-target run only needs the base permission.
  const permissionKey = parsed.data.connectionIds.length > 1 ? "ra_bulk_execute" : "ra_scripts_execute";
  const ra = await requireRemoteAccessPermission(permissionKey);
  if (!isRemoteAccessSession(ra)) return ra;

  try {
    // Approval workflow (Phase 3): a bulk run above the configured threshold is queued for a
    // second admin to approve/reject instead of executing immediately - see
    // /api/admin/remote-access/approvals/[id]/{approve,reject}.
    const settings = await getSettings();
    if (settings.requireApprovalForBulkExecution && parsed.data.connectionIds.length > settings.bulkExecutionApprovalThreshold) {
      const script = await getScript(Number(id));
      const approvalId = await createApprovalRequest(
        "BulkScriptExecution",
        { scriptId: Number(id), connectionIds: parsed.data.connectionIds },
        `Run "${script?.name ?? `#${id}`}" on ${parsed.data.connectionIds.length} connections`,
        ra.userId,
        ra.username
      );
      return NextResponse.json({ ok: true, data: { pendingApprovalId: approvalId } });
    }

    const { batchId, results } = await runScript(Number(id), parsed.data.connectionIds, ra.userId, ra.username);
    await logAdminAction({ admin: ra, section: "remote-access", action: "script_execute", details: `Script #${id} on ${parsed.data.connectionIds.length} connection(s)`, req });
    return NextResponse.json({ ok: true, data: { batchId, results } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Execution failed" }, { status: 400 });
  }
}
