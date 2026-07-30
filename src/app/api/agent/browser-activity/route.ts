import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/agentAuth";
import { ingestBrowserActivitySchema } from "@/lib/browserActivity/schema";
import { ingestBrowserActivityEvents } from "@/lib/browserActivity/repository";

// Always responds 200 (even on auth/validation failure, via `ok: false`) — same reasoning as
// every other /api/agent/* route: IIS replaces non-2xx bodies with a generic HTML page, which
// would otherwise crash the Go agent's json.Decode on the response body.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" });
  }

  // Defense-in-depth: even if an admin never enabled the collector for this device (or
  // disabled it after enabling it), the ingest route itself refuses to store anything unless
  // BrowserActivityIntervalMinutes is currently set — a stale/misbehaving agent binary can't
  // resurrect collection just by posting to this endpoint.
  if (device.browserActivityIntervalMinutes === null) {
    return NextResponse.json({ ok: false, error: "Browser activity collection is not enabled for this device" });
  }

  const body = await req.json().catch(() => null);
  const parsed = ingestBrowserActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" });
  }

  const inserted = await ingestBrowserActivityEvents(device.deviceId, device.staffId, parsed.data.events);
  return NextResponse.json({ ok: true, inserted });
}
