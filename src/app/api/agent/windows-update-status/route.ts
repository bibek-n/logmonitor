import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

// Windows-only status posted every windowsUpdateInterval (6h) by the agent - stored
// directly on Devices (a current-state snapshot, same pattern as LastHeartbeat/LastIp)
// rather than a time-series table, since only the latest value is ever meaningful here.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const lastInstalledAt = typeof body.lastInstalledAt === "string" && body.lastInstalledAt ? new Date(body.lastInstalledAt) : null;
  const recentHotfixCount = typeof body.recentHotfixCount === "number" && Number.isFinite(body.recentHotfixCount) ? Math.round(body.recentHotfixCount) : null;
  const rebootPending = typeof body.rebootPending === "boolean" ? body.rebootPending : null;

  const db = await getDb();
  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("lastInstalledAt", sql.DateTime2, lastInstalledAt)
    .input("recentHotfixCount", sql.Int, recentHotfixCount)
    .input("rebootPending", sql.Bit, rebootPending)
    .query(
      "UPDATE Devices SET LastWindowsUpdateAt = @lastInstalledAt, RecentHotfixCount = @recentHotfixCount, RebootPending = @rebootPending WHERE DeviceId = @deviceId"
    );

  return NextResponse.json({ ok: true });
}
