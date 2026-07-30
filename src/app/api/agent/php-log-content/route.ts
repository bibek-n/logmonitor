import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

// Posted by the agent once it's read a specific version+SAPI's error log tail in response to a
// PendingPhpLogRequests row surfaced via the heartbeat (see agent/php.go's
// handlePendingPhpLogRequests) - upserts the latest content for (device, version, sapi) and
// marks the originating request fulfilled, same "clear the pending flag on upload" pattern as
// malware-scan/route.ts, just scoped to one specific request row instead of every unfulfilled
// one for the device (this request is parameterized, so only the matching row should clear).
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const requestId = Number(body.requestId);
  const version = typeof body.version === "string" ? body.version : "";
  const sapi = typeof body.sapi === "string" ? body.sapi : "";
  const content = typeof body.content === "string" ? body.content : null;
  const errorMessage = typeof body.error === "string" && body.error ? body.error : null;

  if (!version || !sapi) {
    return NextResponse.json({ ok: false, error: "version and sapi are required" }, { status: 400 });
  }

  const db = await getDb();

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("version", sql.VarChar, version)
    .input("sapi", sql.VarChar, sapi)
    .input("content", sql.NVarChar, content)
    .input("errorMessage", sql.NVarChar, errorMessage)
    .query(`
      MERGE PhpLogContent AS target
      USING (SELECT @deviceId AS DeviceId, @version AS Version, @sapi AS Sapi) AS src
        ON target.DeviceId = src.DeviceId AND target.Version = src.Version AND target.Sapi = src.Sapi
      WHEN MATCHED THEN UPDATE SET Content = @content, ErrorMessage = @errorMessage, FetchedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (DeviceId, Version, Sapi, Content, ErrorMessage)
        VALUES (@deviceId, @version, @sapi, @content, @errorMessage);
    `);

  if (Number.isInteger(requestId) && requestId > 0) {
    await db
      .request()
      .input("id", sql.Int, requestId)
      .input("deviceId", sql.VarChar, device.deviceId)
      .query("UPDATE PendingPhpLogRequests SET FulfilledAt = SYSUTCDATETIME() WHERE Id = @id AND DeviceId = @deviceId");
  }

  return NextResponse.json({ ok: true });
}
