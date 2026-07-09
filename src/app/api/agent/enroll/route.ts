import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { generateApiKey, generateDeviceId, hashApiKey } from "@/lib/agentAuth";

const VALID_OS = new Set(["windows", "linux"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { enrollmentToken, hostname, os, osVersion, agentVersion, consentAccepted, macAddress } = body ?? {};

  if (typeof enrollmentToken !== "string" || !enrollmentToken) {
    return NextResponse.json({ ok: false, error: "Missing enrollmentToken" }, { status: 400 });
  }
  if (typeof hostname !== "string" || !hostname) {
    return NextResponse.json({ ok: false, error: "Missing hostname" }, { status: 400 });
  }
  if (typeof os !== "string" || !VALID_OS.has(os)) {
    return NextResponse.json({ ok: false, error: "os must be 'windows' or 'linux'" }, { status: 400 });
  }
  if (consentAccepted !== true) {
    return NextResponse.json({ ok: false, error: "Enrollment requires consentAccepted=true" }, { status: 400 });
  }

  const db = await getDb();

  const tokenResult = await db
    .request()
    .input("token", sql.VarChar, enrollmentToken)
    .query<{ Id: number; ExpiresAt: string; UsedAt: string | null }>(
      "SELECT Id, ExpiresAt, UsedAt FROM EnrollmentTokens WHERE Token = @token"
    );
  const tokenRow = tokenResult.recordset[0];
  if (!tokenRow) {
    return NextResponse.json({ ok: false, error: "Invalid enrollment token" }, { status: 401 });
  }
  if (tokenRow.UsedAt) {
    return NextResponse.json({ ok: false, error: "Enrollment token already used" }, { status: 401 });
  }
  if (new Date(tokenRow.ExpiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Enrollment token expired" }, { status: 401 });
  }

  const deviceId = generateDeviceId();
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("hostname", sql.NVarChar, hostname)
    .input("os", sql.VarChar, os)
    .input("osVersion", sql.NVarChar, osVersion ?? null)
    .input("apiKeyHash", sql.NVarChar, apiKeyHash)
    .input("agentVersion", sql.NVarChar, agentVersion ?? null)
    .input("macAddress", sql.VarChar, typeof macAddress === "string" && macAddress ? macAddress : null)
    .query(`
      INSERT INTO Devices (DeviceId, Hostname, OS, OsVersion, ApiKeyHash, AgentVersion, MacAddress, ConsentAcceptedAt)
      VALUES (@deviceId, @hostname, @os, @osVersion, @apiKeyHash, @agentVersion, @macAddress, SYSUTCDATETIME())
    `);

  await db
    .request()
    .input("tokenId", sql.Int, tokenRow.Id)
    .input("deviceId", sql.VarChar, deviceId)
    .query("UPDATE EnrollmentTokens SET UsedAt = SYSUTCDATETIME(), UsedByDeviceId = @deviceId WHERE Id = @tokenId");

  return NextResponse.json({ ok: true, deviceId, apiKey });
}
