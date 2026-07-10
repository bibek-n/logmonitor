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
    .query<{ Id: number; ExpiresAt: string; UsedAt: string | null; PreCreatedDeviceId: string | null }>(
      "SELECT Id, ExpiresAt, UsedAt, PreCreatedDeviceId FROM EnrollmentTokens WHERE Token = @token"
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

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const macValue = typeof macAddress === "string" && macAddress ? macAddress : null;

  // Server enrollment tokens are minted against a device row the admin already created
  // (Dashboard > Servers > Add Server) — reconcile that same row instead of inserting a
  // new one. Plain workstation tokens (PreCreatedDeviceId null) keep today's behavior
  // byte-for-byte: a brand-new Devices row, entirely agent-supplied.
  let deviceId: string;
  if (tokenRow.PreCreatedDeviceId) {
    deviceId = tokenRow.PreCreatedDeviceId;
    await db
      .request()
      .input("deviceId", sql.VarChar, deviceId)
      .input("hostname", sql.NVarChar, hostname)
      .input("os", sql.VarChar, os)
      .input("osVersion", sql.NVarChar, osVersion ?? null)
      .input("apiKeyHash", sql.NVarChar, apiKeyHash)
      .input("agentVersion", sql.NVarChar, agentVersion ?? null)
      .input("macAddress", sql.VarChar, macValue)
      .query(`
        UPDATE Devices SET
          Hostname = @hostname, OS = @os, OsVersion = @osVersion, ApiKeyHash = @apiKeyHash,
          AgentVersion = @agentVersion, MacAddress = COALESCE(@macAddress, MacAddress),
          ConsentAcceptedAt = SYSUTCDATETIME(), EnrolledAt = SYSUTCDATETIME(),
          LifecycleStatus = CASE WHEN LifecycleStatus = 'Pending' THEN 'Active' ELSE LifecycleStatus END
        WHERE DeviceId = @deviceId
      `);
  } else {
    deviceId = generateDeviceId();
    await db
      .request()
      .input("deviceId", sql.VarChar, deviceId)
      .input("hostname", sql.NVarChar, hostname)
      .input("os", sql.VarChar, os)
      .input("osVersion", sql.NVarChar, osVersion ?? null)
      .input("apiKeyHash", sql.NVarChar, apiKeyHash)
      .input("agentVersion", sql.NVarChar, agentVersion ?? null)
      .input("macAddress", sql.VarChar, macValue)
      .query(`
        INSERT INTO Devices (DeviceId, Hostname, OS, OsVersion, ApiKeyHash, AgentVersion, MacAddress, ConsentAcceptedAt)
        VALUES (@deviceId, @hostname, @os, @osVersion, @apiKeyHash, @agentVersion, @macAddress, SYSUTCDATETIME())
      `);
  }

  await db
    .request()
    .input("tokenId", sql.Int, tokenRow.Id)
    .input("deviceId", sql.VarChar, deviceId)
    .query("UPDATE EnrollmentTokens SET UsedAt = SYSUTCDATETIME(), UsedByDeviceId = @deviceId WHERE Id = @tokenId");

  return NextResponse.json({ ok: true, deviceId, apiKey });
}
