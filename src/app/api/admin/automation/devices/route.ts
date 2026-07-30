import { NextResponse } from "next/server";
import { isAutomationSession, requireAutomationPermission } from "@/lib/requireAutomationPermission";
import { listEligibleDevices } from "@/lib/automation/repository";

// Devices Automation can target - every enrolled Server/Workstation, same target set as
// Malware Detection's on-demand scan (see the scoping research: only endpoint-agent-enrolled
// devices, never arbitrary SSH/WinRM hosts).
export async function GET() {
  const automation = await requireAutomationPermission("auto_view");
  if (!isAutomationSession(automation)) return automation;

  const devices = await listEligibleDevices();
  return NextResponse.json({ ok: true, data: devices });
}
