import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/agentAuth";
import { scanSchema, ingestUpdateScan } from "@/lib/securityUpdates/ingest";

// Receives one Security & Updates scan from the endpoint agent (agent/updates.go). Always responds 200
// (via `ok: false` on problems) - see src/app/api/agent/enroll/route.ts for why: IIS replaces non-2xx
// bodies with a generic HTML page.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" });
  }

  const parsed = scanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid scan payload" });
  }

  try {
    await ingestUpdateScan({ deviceId: device.deviceId, hostname: device.hostname }, parsed.data);
  } catch (err) {
    console.error("update-scan ingest failed", err);
    return NextResponse.json({ ok: false, error: "Failed to record scan" });
  }
  return NextResponse.json({ ok: true });
}
