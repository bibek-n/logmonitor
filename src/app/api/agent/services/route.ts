import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/agentAuth";
import { upsertSnapshot } from "@/lib/deviceSnapshots";
import { raiseAlertIfNew } from "@/lib/deviceAlerts";

// Services worth alerting on if they stop unexpectedly — a small, deliberately narrow
// allowlist (not every stopped service is noteworthy) rather than alerting on any of
// potentially hundreds of services, most of which are expected to be stopped/manual.
const WATCHED_SERVICES = new Set(["LogMonitorAgent", "WinDefend", "mpssvc", "ssh", "sshd"]);

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.services)) {
    return NextResponse.json({ ok: false, error: "Expected { services: [...] }" }, { status: 400 });
  }

  await upsertSnapshot("DeviceServiceSnapshot", "ServicesJson", device.deviceId, body.services);

  for (const svc of body.services as { name?: string; status?: string }[]) {
    if (svc.name && WATCHED_SERVICES.has(svc.name) && svc.status === "stopped") {
      await raiseAlertIfNew(device.deviceId, `service_stopped_${svc.name}`, "warning", `Service "${svc.name}" is stopped.`);
    }
  }

  return NextResponse.json({ ok: true });
}
