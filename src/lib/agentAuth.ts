import crypto from "crypto";
import { getDb, sql } from "./db";

export interface AuthenticatedDevice {
  id: number;
  deviceId: string;
  hostname: string;
  screenshotIntervalMinutes: number | null;
  privacyMode: boolean;
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateEnrollmentToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function generateDeviceId(): string {
  return crypto.randomUUID();
}

// Not a secret in the same sense as the API key — it only ever authorizes read/write access
// to one device's own chat thread, never telemetry — but still high-entropy so it can't be
// guessed, since the employee chat page has no login of its own.
export function generateChatToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// API keys are high-entropy random secrets (not human passwords), so a fast constant-time
// hash compare is appropriate here — unlike user login passwords (bcrypt) which need slow
// hashing to resist brute-forcing low-entropy input.
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

interface DeviceAuthRow {
  Id: number;
  DeviceId: string;
  Hostname: string;
  ApiKeyHash: string;
  ScreenshotIntervalMinutes: number | null;
  PrivacyMode: boolean;
}

// Authenticates an agent request via the `X-Device-Id` + `Authorization: Bearer <apiKey>`
// headers. Returns null on any auth failure (unknown device, wrong key) without
// distinguishing why, so callers can return a uniform 401.
export async function authenticateDevice(req: Request): Promise<AuthenticatedDevice | null> {
  const deviceId = req.headers.get("x-device-id");
  const authHeader = req.headers.get("authorization");
  if (!deviceId || !authHeader?.startsWith("Bearer ")) return null;
  const apiKey = authHeader.slice("Bearer ".length).trim();
  if (!apiKey) return null;

  const db = await getDb();
  const result = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<DeviceAuthRow>(
      "SELECT Id, DeviceId, Hostname, ApiKeyHash, ScreenshotIntervalMinutes, PrivacyMode FROM Devices WHERE DeviceId = @deviceId"
    );

  const device = result.recordset[0];
  if (!device) return null;
  if (!timingSafeEqualHex(hashApiKey(apiKey), device.ApiKeyHash)) return null;

  return {
    id: device.Id,
    deviceId: device.DeviceId,
    hostname: device.Hostname,
    screenshotIntervalMinutes: device.ScreenshotIntervalMinutes,
    privacyMode: device.PrivacyMode,
  };
}
