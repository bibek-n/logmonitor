import { NextRequest, NextResponse } from "next/server";
import { isAutomationSession, requireAutomationPermission } from "@/lib/requireAutomationPermission";
import { getJob } from "@/lib/automation/repository";

// Polled by the Remote Tasks detail page while a job is in flight - same plain re-fetch
// pattern as Malware Detection's on-demand scan result view, no websocket/push.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const automation = await requireAutomationPermission("auto_view");
  if (!isAutomationSession(automation)) return automation;

  const { id } = await params;
  const job = await getJob(Number(id));
  if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: job });
}
