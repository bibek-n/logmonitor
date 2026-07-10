import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { generateApiKey, generateDeviceId, hashApiKey } from "@/lib/agentAuth";

const VALID_OS = new Set(["windows", "linux"]);

// This route always responds 200 (even on logical failure, via `ok: false`) rather than a
// real 4xx/5xx status — this app's IIS front end replaces any non-2xx response body with a
// generic HTML error page, which would otherwise swallow the JSON error payload and hand
// the Go agent's `json.Decode` an HTML document instead ("invalid character '<' looking
// for beginning of value"). Same fix already applied to the OTP login routes.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { enrollmentToken, hostname, os, osVersion, agentVersion, consentAccepted, macAddress } = body ?? {};

  if (typeof enrollmentToken !== "string" || !enrollmentToken) {
    return NextResponse.json({ ok: false, error: "Missing enrollmentToken" });
  }
  if (typeof hostname !== "string" || !hostname) {
    return NextResponse.json({ ok: false, error: "Missing hostname" });
  }
  if (typeof os !== "string" || !VALID_OS.has(os)) {
    return NextResponse.json({ ok: false, error: "os must be 'windows' or 'linux'" });
  }
  if (consentAccepted !== true) {
    return NextResponse.json({ ok: false, error: "Enrollment requires consentAccepted=true" });
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
    return NextResponse.json({ ok: false, error: "Invalid enrollment token" });
  }
  if (tokenRow.UsedAt) {
    return NextResponse.json({ ok: false, error: "Enrollment token already used" });
  }
  if (new Date(tokenRow.ExpiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Enrollment token expired" });
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
