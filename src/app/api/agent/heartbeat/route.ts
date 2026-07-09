import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const ip = clientIp(req);

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("ip", sql.VarChar, ip)
    .query("UPDATE Devices SET LastHeartbeat = SYSUTCDATETIME(), LastIp = @ip WHERE DeviceId = @deviceId");

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
