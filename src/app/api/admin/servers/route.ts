import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { generateApiKey, generateDeviceId, generateEnrollmentToken, hashApiKey } from "@/lib/agentAuth";
import { logAdminAction } from "@/lib/adminAudit";

const TOKEN_TTL_HOURS = 24 * 7; // servers may not get installed same-day as registration

const VALID_OS = new Set(["windows", "linux"]);
const VALID_STATUS = new Set(["Pending", "Active", "Maintenance", "Decommissioned"]);

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`
    SELECT DeviceId, DeviceName, Hostname, StaticIpAddress, LastIp, ServerRole, OS, LifecycleStatus,
      MacAddress, LastHeartbeat, AgentVersion, EnrolledAt
    FROM Devices
    WHERE DeviceType = 'Server'
    ORDER BY DeviceName ASC, Hostname ASC
  `;
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const deviceName = typeof body?.deviceName === "string" ? body.deviceName.trim() : "";
  const hostname = typeof body?.hostname === "string" ? body.hostname.trim() : "";
  const ipAddress = typeof body?.ipAddress === "string" ? body.ipAddress.trim() : "";
  const serverRole = typeof body?.serverRole === "string" ? body.serverRole.trim() : "";
  const operatingSystem = typeof body?.operatingSystem === "string" ? body.operatingSystem : "";
  const status = typeof body?.status === "string" ? body.status : "Pending";
  const macAddress = typeof body?.macAddress === "string" ? body.macAddress.trim() : "";

  if (!deviceName) {
    return NextResponse.json({ ok: false, error: "Device Name is required." }, { status: 400 });
  }
  if (!VALID_OS.has(operatingSystem)) {
    return NextResponse.json({ ok: false, error: "Operating System must be windows or linux." }, { status: 400 });
  }
  const lifecycleStatus = VALID_STATUS.has(status) ? status : "Pending";
  // Hostname and MAC Address are optional at registration — both get filled in
  // automatically from the real values the agent reports at enroll time (see
  // /api/agent/enroll's PreCreatedDeviceId branch, which overwrites Hostname
  // unconditionally and MacAddress via COALESCE). Hostname's column is NOT NULL, so an
  // empty string is the "not yet known" placeholder until then.
  const hostnameValue = hostname || "";

  const deviceId = generateDeviceId();
  // Placeholder — no real agent has enrolled yet, so no real API key exists. This random
  // hash will never match any presented Bearer token; /api/agent/enroll overwrites it with
  // the real one once the agent actually runs on the server.
  const placeholderApiKeyHash = hashApiKey(generateApiKey());

  const db = await getDb();
  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("deviceName", sql.NVarChar, deviceName)
    .input("hostname", sql.NVarChar, hostnameValue)
    .input("os", sql.VarChar, operatingSystem)
    .input("apiKeyHash", sql.NVarChar, placeholderApiKeyHash)
    .input("staticIpAddress", sql.VarChar, ipAddress || null)
    .input("serverRole", sql.NVarChar, serverRole || null)
    .input("lifecycleStatus", sql.NVarChar, lifecycleStatus)
    .input("macAddress", sql.VarChar, macAddress || null)
    .query(`
      INSERT INTO Devices (DeviceId, DeviceName, Hostname, OS, ApiKeyHash, DeviceType, StaticIpAddress, ServerRole, LifecycleStatus, MacAddress)
      VALUES (@deviceId, @deviceName, @hostname, @os, @apiKeyHash, 'Server', @staticIpAddress, @serverRole, @lifecycleStatus, @macAddress)
    `);

  const token = generateEnrollmentToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000);
  await db
    .request()
    .input("token", sql.VarChar, token)
    .input("createdBy", sql.Int, admin.userId)
    .input("expiresAt", sql.DateTime2, expiresAt)
    .input("preCreatedDeviceId", sql.VarChar, deviceId)
    .query("INSERT INTO EnrollmentTokens (Token, CreatedByUserId, ExpiresAt, PreCreatedDeviceId) VALUES (@token, @createdBy, @expiresAt, @preCreatedDeviceId)");

  await logAdminAction({ admin, section: "servers", action: "create_server", details: `${deviceName}${hostnameValue ? ` (${hostnameValue})` : ""}`, req });

  return NextResponse.json({ ok: true, deviceId, token, expiresAt: expiresAt.toISOString() });
}
