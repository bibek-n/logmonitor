import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/agentAuth";
import { installResultSchema, ingestInstallResult } from "@/lib/securityUpdates/installs";

// Receives the state/result of an admin-approved update install from the endpoint agent (agent/updates_install.go).
// The first call per request is status "running": the agent only starts installing if THAT call returns ok:true, and it
// can succeed only once (at-most-once execution). Always HTTP 200 (see update-scan/route.ts: IIS replaces non-2xx bodies).
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) return NextResponse.json({ ok: false, error: "Unauthorized" });

  const parsed = installResultSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid result payload" });

  try {
    const r = await ingestInstallResult({ deviceId: device.deviceId, hostname: device.hostname }, parsed.data);
    return NextResponse.json(r.ok ? { ok: true } : { ok: false, error: r.error ?? "Rejected" });
  } catch (err) {
    console.error("update-result ingest failed", err);
    return NextResponse.json({ ok: false, error: "Failed to record result" });
  }
}
