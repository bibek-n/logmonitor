import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

// Always responds 200 (even on auth failure, via `ok: false`) — see the comment in
// src/app/api/agent/enroll/route.ts for why: IIS replaces non-2xx bodies with a generic
// HTML page, which would otherwise crash the Go agent's json.Decode on the response body.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" });
  }

  const db = await getDb();
  const ip = clientIp(req);
  const body = await req.json().catch(() => ({}));
  const agentVersion = typeof body?.agentVersion === "string" ? body.agentVersion : null;
  const currentUser = typeof body?.currentUser === "string" && body.currentUser ? body.currentUser : null;

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("ip", sql.VarChar, ip)
    .input("agentVersion", sql.NVarChar, agentVersion)
    .input("currentUser", sql.NVarChar, currentUser)
    .query(`
      UPDATE Devices
      SET LastHeartbeat = SYSUTCDATETIME(), LastIp = @ip,
        AgentVersion = COALESCE(@agentVersion, AgentVersion),
        CurrentUser = COALESCE(@currentUser, CurrentUser)
      WHERE DeviceId = @deviceId
    `);

  const pendingResult = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ Cnt: number }>(
      "SELECT COUNT(*) AS Cnt FROM PendingScreenshotRequests WHERE DeviceId = @deviceId AND FulfilledAt IS NULL"
    );

  return NextResponse.json({
    ok: true,
    screenshotIntervalMinutes: device.screenshotIntervalMinutes,
    privacyMode: device.privacyMode,
    pendingScreenshotRequest: (pendingResult.recordset[0]?.Cnt ?? 0) > 0,
  });
}
