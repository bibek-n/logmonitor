import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";
import { getPendingJobsForDevice } from "@/lib/automation/repository";
import { listExcludedDomainStrings } from "@/lib/browserActivity/repository";

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return null;
}

// Always responds 200 (even on auth failure, via `ok: false`) — see the comment in
// src/app/api/agent/enroll/route.ts for why: IIS replaces non-2xx bodies with a generic
// HTML page, which would otherwise crash the Go agent's json.Decode on the response body.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" });
  }

  const db = await getDb();
  const ip = clientIp(req);
  const body = await req.json().catch(() => ({}));
  const agentVersion = typeof body?.agentVersion === "string" ? body.agentVersion : null;
  const currentUser = typeof body?.currentUser === "string" && body.currentUser ? body.currentUser : null;

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("ip", sql.VarChar, ip)
    .input("agentVersion", sql.NVarChar, agentVersion)
    .input("currentUser", sql.NVarChar, currentUser)
    .query(`
      UPDATE Devices
      SET LastHeartbeat = SYSUTCDATETIME(), LastIp = @ip,
        AgentVersion = COALESCE(@agentVersion, AgentVersion),
        CurrentUser = COALESCE(@currentUser, CurrentUser)
      WHERE DeviceId = @deviceId
    `);

  const pendingResult = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ Cnt: number }>(
      "SELECT COUNT(*) AS Cnt FROM PendingScreenshotRequests WHERE DeviceId = @deviceId AND FulfilledAt IS NULL"
    );

  const pendingMalwareScanResult = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ Cnt: number }>(
      "SELECT COUNT(*) AS Cnt FROM PendingMalwareScanRequests WHERE DeviceId = @deviceId AND FulfilledAt IS NULL"
    );

  // Parameterized (which version, which SAPI) unlike the boolean flags above, so the full row
  // set is returned rather than just a count - see agent/php.go's handlePendingPhpLogRequests.
  const pendingPhpLogResult = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ Id: number; Version: string; Sapi: string }>(
      "SELECT Id, Version, Sapi FROM PendingPhpLogRequests WHERE DeviceId = @deviceId AND FulfilledAt IS NULL"
    );

  // Sent on every heartbeat (not just when changed) so the agent's own diff-against-last-applied
  // logic (agent/usbpolicy_windows.go) is the single source of truth for what changed - simpler
  // than trying to track a "since" cursor server-side. Windows-only enforcement; a Linux/other
  // agent receives this same list but has no enforcement code wired to it (see
  // agent/usbpolicy_other.go), so it's harmless to always include.
  const usbBlockListResult = await db.query<{
    VendorId: string | null;
    ProductId: string | null;
    SerialNumber: string | null;
    DeviceNamePattern: string | null;
  }>("SELECT VendorId, ProductId, SerialNumber, DeviceNamePattern FROM UsbDevicePolicies WHERE Action = 'Block' AND IsActive = 1");

  // Per-device (unlike usbBlockList above) - each device watches its own file paths, not a
  // shared list every endpoint applies identically.
  const watchedFilesResult = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ FilePath: string }>("SELECT FilePath FROM WatchedFiles WHERE DeviceId = @deviceId AND Enabled = 1");

  // Automation: resolved per this device's own OS (see getPendingJobsForDevice) so the agent
  // never has to decide which of a job's two script-body snapshots applies to it.
  const osResult = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ OS: string }>("SELECT OS FROM Devices WHERE DeviceId = @deviceId");
  const pendingAutomationJobs = await getPendingJobsForDevice(device.deviceId, osResult.recordset[0]?.OS ?? "");

  // Browser Activity Audit: excluded-domain suffixes are sent on every heartbeat (same "always
  // send, never diff server-side" convention as usbBlockList above) so the agent's pre-filter
  // (the primary enforcement point for sensitive-domain exclusion, see the approved plan) is
  // never running against a stale list for more than one heartbeat interval.
  const excludedDomainSuffixes = device.browserActivityIntervalMinutes !== null ? await listExcludedDomainStrings() : [];

  return NextResponse.json({
    ok: true,
    screenshotIntervalMinutes: device.screenshotIntervalMinutes,
    browserActivityIntervalMinutes: device.browserActivityIntervalMinutes,
    excludedDomainSuffixes,
    privacyMode: device.privacyMode,
    pendingScreenshotRequest: (pendingResult.recordset[0]?.Cnt ?? 0) > 0,
    pendingMalwareScanRequest: (pendingMalwareScanResult.recordset[0]?.Cnt ?? 0) > 0,
    pendingPhpLogRequests: pendingPhpLogResult.recordset.map((r) => ({ id: r.Id, version: r.Version, sapi: r.Sapi })),
    pendingAutomationJobs: pendingAutomationJobs.map((j) => ({
      requestId: j.requestId,
      jobId: j.jobId,
      scriptBody: j.scriptBody,
      shell: j.shell,
      timeoutSeconds: j.timeoutSeconds,
    })),
    usbBlockList: usbBlockListResult.recordset.map((r) => ({
      vendorId: r.VendorId,
      productId: r.ProductId,
      serialNumber: r.SerialNumber,
      deviceNamePattern: r.DeviceNamePattern,
    })),
    watchedFiles: watchedFilesResult.recordset.map((r) => r.FilePath),
  });
}
