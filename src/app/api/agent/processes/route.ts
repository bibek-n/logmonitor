import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/agentAuth";
import { upsertSnapshot } from "@/lib/deviceSnapshots";

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.processes)) {
    return NextResponse.json({ ok: false, error: "Expected { processes: [...] }" }, { status: 400 });
  }

  await upsertSnapshot("DeviceProcessSnapshot", "ProcessesJson", device.deviceId, body.processes);

  return NextResponse.json({ ok: true });
}
