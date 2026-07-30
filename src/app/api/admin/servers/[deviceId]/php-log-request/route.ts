import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

const VALID_SAPI = new Set(["fpm", "cli"]);

// Queues an on-demand PHP error-log fetch, same "request now, agent picks it up on next
// heartbeat (~30s)" pattern as malware-detection's scan-request route - except this one is
// parameterized (which version, which SAPI), so it dedupes against any already-unfulfilled
// request for the exact same (device, version, sapi) rather than queuing a duplicate every time
// the admin console re-polls.
export async function POST(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { deviceId } = await params;
  const body = await req.json().catch(() => null);
  const version = typeof body?.version === "string" ? body.version : "";
  const sapi = typeof body?.sapi === "string" ? body.sapi : "";
  if (!version || !VALID_SAPI.has(sapi)) {
    return NextResponse.json({ ok: false, error: "version and a valid sapi ('fpm' or 'cli') are required" }, { status: 400 });
  }

  const db = await getDb();

  const deviceResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{ DeviceId: string }>("SELECT DeviceId FROM Devices WHERE DeviceId = @deviceId AND DeviceType = 'Server' AND PhpDetected = 1");
  if (!deviceResult.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Server not found or has no PHP detected" }, { status: 404 });
  }

  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("version", sql.VarChar, version)
    .input("sapi", sql.VarChar, sapi)
    .query<{ Id: number }>(
      "SELECT Id FROM PendingPhpLogRequests WHERE DeviceId = @deviceId AND Version = @version AND Sapi = @sapi AND FulfilledAt IS NULL"
    );
  if (existing.recordset[0]) {
    return NextResponse.json({ ok: true, requestId: existing.recordset[0].Id, alreadyPending: true });
  }

  const insertResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("version", sql.VarChar, version)
    .input("sapi", sql.VarChar, sapi)
    .input("requestedByUserId", sql.Int, admin.userId)
    .query<{ Id: number }>(`
      INSERT INTO PendingPhpLogRequests (DeviceId, Version, Sapi, RequestedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@deviceId, @version, @sapi, @requestedByUserId)
    `);

  return NextResponse.json({ ok: true, requestId: insertResult.recordset[0].Id, alreadyPending: false });
}
