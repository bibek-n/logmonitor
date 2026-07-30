import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/agentAuth";
import { recordJobResult } from "@/lib/automation/repository";
import type { AutomationJobTargetStatus } from "@/lib/automation/types";

const VALID_STATUSES: AutomationJobTargetStatus[] = ["Success", "Failed", "TimedOut", "Error"];

// Posted by the agent once it's finished running a script it picked up via the heartbeat's
// pendingAutomationJobs (see agent/automation.go's handlePendingAutomationJobs). requestId is
// AutomationJobTargets.Id - a real per-device-per-job identity (unlike malware-scan's coarse
// "mark any unfulfilled request done" pattern), so this only ever updates the one row that
// actually ran. recordJobResult's own WHERE Status='Pending' guard means a stray duplicate
// POST (e.g. a retried upload) can never overwrite an already-recorded result.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const requestId = Number(body.requestId);
  const status = typeof body.status === "string" ? body.status : "";
  if (!Number.isInteger(requestId) || requestId <= 0 || !VALID_STATUSES.includes(status as AutomationJobTargetStatus)) {
    return NextResponse.json({ ok: false, error: "requestId and a valid status are required" }, { status: 400 });
  }

  await recordJobResult(requestId, device.deviceId, {
    status: status as AutomationJobTargetStatus,
    exitCode: typeof body.exitCode === "number" ? body.exitCode : null,
    stdout: typeof body.stdout === "string" ? body.stdout : "",
    stderr: typeof body.stderr === "string" ? body.stderr : "",
    errorMessage: typeof body.errorMessage === "string" && body.errorMessage ? body.errorMessage : null,
  });

  return NextResponse.json({ ok: true });
}
