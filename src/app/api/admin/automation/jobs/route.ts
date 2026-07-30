import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isAutomationSession, requireAutomationPermission } from "@/lib/requireAutomationPermission";
import { runJobSchema } from "@/lib/automation/schema";
import { createJob, getScript, listJobs } from "@/lib/automation/repository";

export async function GET(req: NextRequest) {
  const automation = await requireAutomationPermission("auto_view");
  if (!isAutomationSession(automation)) return automation;

  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 500 ? limitParam : 100;

  const jobs = await listJobs(limit);
  return NextResponse.json({ ok: true, data: jobs });
}

// "Run Now" - the manual Remote Task trigger. Snapshots the script's current body onto the new
// job (see createJob's comment) so the audit trail always reflects exactly what was sent to a
// real, credentialed, SYSTEM/root-level agent process, immune to the script being edited or
// deleted afterward.
export async function POST(req: NextRequest) {
  const automation = await requireAutomationPermission("auto_job_run");
  if (!isAutomationSession(automation)) return automation;

  const body = await req.json().catch(() => null);
  const parsed = runJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid run request" }, { status: 400 });
  }

  const script = await getScript(parsed.data.scriptId);
  if (!script) return NextResponse.json({ ok: false, error: "Script not found" }, { status: 404 });

  const jobId = await createJob({
    scriptId: script.id,
    scriptNameSnapshot: script.name,
    powerShellBodySnapshot: script.powerShellBody,
    bashBodySnapshot: script.bashBody,
    timeoutSeconds: script.timeoutSeconds,
    triggerType: "Manual",
    scheduleId: null,
    requestedByUserId: automation.userId,
    deviceIds: parsed.data.deviceIds,
  });

  await logAdminAction({
    admin: automation,
    section: "automation",
    action: "job_run",
    details: `${script.name} -> ${parsed.data.deviceIds.length} device(s) (job #${jobId})`,
    req,
  });

  return NextResponse.json({ ok: true, data: { id: jobId } });
}
