import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

interface PhpVersionPayload {
  version?: string;
  sapiCli?: boolean;
  sapiFpm?: boolean;
  cliErrorLogPath?: string;
  fpmErrorLogPath?: string;
  isDefault?: boolean;
}

// Posted every phpPollInterval (15m) by the agent, only on Linux devices (see PhpDetected()'s
// runtime.GOOS=="linux" gate) - a Windows agent never calls this route. PhpVersions is a
// delete-then-insert child table, same pattern as LinuxOpenPorts.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const detected = body.detected === true;
  const db = await getDb();

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("detected", sql.Bit, detected)
    .query("UPDATE Devices SET PhpDetected = @detected, LastPhpCheckAt = SYSUTCDATETIME() WHERE DeviceId = @deviceId");

  await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM PhpVersions WHERE DeviceId = @deviceId");

  if (!detected) {
    return NextResponse.json({ ok: true });
  }

  const versions: PhpVersionPayload[] = Array.isArray(body.versions) ? body.versions : [];
  for (const v of versions) {
    if (!v.version) continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("version", sql.VarChar, v.version)
      .input("sapiCli", sql.Bit, v.sapiCli === true)
      .input("sapiFpm", sql.Bit, v.sapiFpm === true)
      .input("cliErrorLogPath", sql.NVarChar, v.cliErrorLogPath || null)
      .input("fpmErrorLogPath", sql.NVarChar, v.fpmErrorLogPath || null)
      .input("isDefault", sql.Bit, v.isDefault === true)
      .query(`
        INSERT INTO PhpVersions (DeviceId, Version, SapiCli, SapiFpm, CliErrorLogPath, FpmErrorLogPath, IsDefault)
        VALUES (@deviceId, @version, @sapiCli, @sapiFpm, @cliErrorLogPath, @fpmErrorLogPath, @isDefault)
      `);
  }

  return NextResponse.json({ ok: true });
}
