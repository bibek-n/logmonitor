import { NextRequest, NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { listScriptExecutions } from "@/lib/remoteAccess/repository";

export async function GET(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_scripts_execute");
  if (!isRemoteAccessSession(ra)) return ra;

  const scriptId = req.nextUrl.searchParams.get("scriptId");
  const batchId = req.nextUrl.searchParams.get("batchId");
  const executions = await listScriptExecutions({ scriptId: scriptId ? Number(scriptId) : undefined, batchId: batchId ?? undefined });
  return NextResponse.json({ ok: true, data: executions });
}
