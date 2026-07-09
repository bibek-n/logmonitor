import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("cpuPct", sql.Float, num(body.cpuPct))
    .input("memPct", sql.Float, num(body.memPct))
    .input("diskPct", sql.Float, num(body.diskPct))
    .input("netRxMbps", sql.Float, num(body.netRxMbps))
    .input("netTxMbps", sql.Float, num(body.netTxMbps))
    .input("uptimeSeconds", sql.BigInt, num(body.uptimeSeconds))
    .query(`
      INSERT INTO DeviceMetrics (DeviceId, CpuPct, MemPct, DiskPct, NetRxMbps, NetTxMbps, UptimeSeconds)
      VALUES (@deviceId, @cpuPct, @memPct, @diskPct, @netRxMbps, @netTxMbps, @uptimeSeconds)
    `);

  return NextResponse.json({ ok: true });
}
