import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";
import { raiseAlertIfNew, resolveAlert } from "@/lib/deviceAlerts";

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function int(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}
function bit(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

interface VolumePayload {
  mountPoint?: string;
  device?: string;
  fsType?: string;
  totalGB?: number;
  freeGB?: number;
  usedPercent?: number;
}

const HIGH_USAGE_THRESHOLD = 90;

async function checkThreshold(deviceId: string, alertType: string, value: number | null, label: string) {
  if (value === null) return;
  if (value > HIGH_USAGE_THRESHOLD) {
    await raiseAlertIfNew(deviceId, alertType, "critical", `${label} usage is at ${value.toFixed(0)}% (>${HIGH_USAGE_THRESHOLD}%).`);
  } else {
    await resolveAlert(deviceId, alertType);
  }
}

// Same "disk_high" alert as checkThreshold's percentage-based check, but with the actual
// free-space number in the message when we have it - "12% free" reads very differently on a
// 4TB drive than a 128GB one, and admins asked for this to be legible at a glance.
async function checkLowDiskSpace(deviceId: string, diskPct: number | null, freeGB: number | null) {
  if (diskPct === null) return;
  if (diskPct > HIGH_USAGE_THRESHOLD) {
    const freeText = freeGB !== null ? ` (${freeGB.toFixed(1)} GB free)` : "";
    await raiseAlertIfNew(deviceId, "disk_high", "critical", `Disk usage is at ${diskPct.toFixed(0)}% (>${HIGH_USAGE_THRESHOLD}%)${freeText}.`);
  } else {
    await resolveAlert(deviceId, "disk_high");
  }
}

// A reboot is inferred server-side rather than shipped as an explicit agent event: every
// metrics upload already carries uptimeSeconds, so "now - uptime" gives the host's current
// boot time for free. If that differs from the boot time recorded on the previous upload by
// more than the tolerance below, the uptime counter reset - the host rebooted in between.
// The tolerance absorbs normal clock/measurement drift between successive 30s heartbeats
// without needing a second, separate collector.
const REBOOT_DETECTION_TOLERANCE_MS = 2 * 60 * 1000;

async function detectAndRecordReboot(deviceId: string, uptimeSeconds: number | null) {
  if (uptimeSeconds === null) return;
  const db = await getDb();
  const computedBootTime = new Date(Date.now() - uptimeSeconds * 1000);

  const existing = await db.request().input("deviceId", sql.VarChar, deviceId).query<{ LastBootTime: string | null }>(
    "SELECT CONVERT(VARCHAR(19), LastBootTime, 126) AS LastBootTime FROM Devices WHERE DeviceId = @deviceId"
  );
  const previousBootTime = existing.recordset[0]?.LastBootTime ? new Date(existing.recordset[0].LastBootTime + "Z") : null;

  const rebooted = previousBootTime !== null && Math.abs(computedBootTime.getTime() - previousBootTime.getTime()) > REBOOT_DETECTION_TOLERANCE_MS;

  if (rebooted) {
    await db
      .request()
      .input("deviceId", sql.VarChar, deviceId)
      .input("message", sql.NVarChar, `Server rebooted - new boot time ${computedBootTime.toISOString()}.`)
      .query(
        "INSERT INTO ServerLogEntries (DeviceId, LogSource, Severity, Message) VALUES (@deviceId, 'reboot', 'info', @message)"
      );
  }

  if (rebooted || previousBootTime === null) {
    await db.request().input("deviceId", sql.VarChar, deviceId).input("bootTime", sql.DateTime2, computedBootTime).query(
      "UPDATE Devices SET LastBootTime = @bootTime WHERE DeviceId = @deviceId"
    );
  }
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

  const cpuPct = num(body.cpuPct);
  const memPct = num(body.memPct);
  const diskPct = num(body.diskPct);
  const uptimeSeconds = num(body.uptimeSeconds);

  const db = await getDb();
  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("cpuPct", sql.Float, cpuPct)
    .input("memPct", sql.Float, memPct)
    .input("diskPct", sql.Float, diskPct)
    .input("netRxMbps", sql.Float, num(body.netRxMbps))
    .input("netTxMbps", sql.Float, num(body.netTxMbps))
    .input("uptimeSeconds", sql.BigInt, uptimeSeconds)
    .input("swapPct", sql.Float, num(body.swapPct))
    .input("diskReadMBps", sql.Float, num(body.diskReadMBps))
    .input("diskWriteMBps", sql.Float, num(body.diskWriteMBps))
    .input("diskIops", sql.Float, num(body.diskIops))
    .input("diskLatencyMs", sql.Float, num(body.diskLatencyMs))
    .input("processCount", sql.Int, int(body.processCount))
    .input("threadCount", sql.Int, int(body.threadCount))
    .input("handleCount", sql.Int, int(body.handleCount))
    .input("loadAvg1", sql.Float, num(body.loadAvg1))
    .input("loadAvg5", sql.Float, num(body.loadAvg5))
    .input("loadAvg15", sql.Float, num(body.loadAvg15))
    .input("gpuUsagePct", sql.Float, num(body.gpuUsagePct))
    .input("batteryPct", sql.Float, num(body.batteryPct))
    .input("batteryHealth", sql.NVarChar, body.batteryHealth || null)
    .input("batteryCycleCount", sql.Int, int(body.batteryCycleCount))
    .input("powerAdapterConnected", sql.Bit, bit(body.powerAdapterConnected))
    .input("cpuTempC", sql.Float, num(body.cpuTempC))
    .input("diskFreeGB", sql.Float, num(body.diskFreeGB))
    .input("diskTotalGB", sql.Float, num(body.diskTotalGB))
    .query(`
      INSERT INTO DeviceMetrics (
        DeviceId, CpuPct, MemPct, DiskPct, NetRxMbps, NetTxMbps, UptimeSeconds,
        SwapPct, DiskReadMBps, DiskWriteMBps, DiskIops, DiskLatencyMs, ProcessCount, ThreadCount, HandleCount,
        LoadAvg1, LoadAvg5, LoadAvg15, GpuUsagePct, BatteryPct, BatteryHealth, BatteryCycleCount,
        PowerAdapterConnected, CpuTempC, DiskFreeGB, DiskTotalGB
      )
      VALUES (
        @deviceId, @cpuPct, @memPct, @diskPct, @netRxMbps, @netTxMbps, @uptimeSeconds,
        @swapPct, @diskReadMBps, @diskWriteMBps, @diskIops, @diskLatencyMs, @processCount, @threadCount, @handleCount,
        @loadAvg1, @loadAvg5, @loadAvg15, @gpuUsagePct, @batteryPct, @batteryHealth, @batteryCycleCount,
        @powerAdapterConnected, @cpuTempC, @diskFreeGB, @diskTotalGB
      )
    `);

  await checkThreshold(device.deviceId, "cpu_high", cpuPct, "CPU");
  await checkThreshold(device.deviceId, "mem_high", memPct, "Memory");
  await checkLowDiskSpace(device.deviceId, diskPct, num(body.diskFreeGB));
  await detectAndRecordReboot(device.deviceId, uptimeSeconds);

  const volumes: VolumePayload[] = Array.isArray(body.volumes) ? body.volumes : [];
  await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM DeviceVolumes WHERE DeviceId = @deviceId");
  for (const v of volumes) {
    if (!v.mountPoint) continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("mountPoint", sql.NVarChar, v.mountPoint)
      .input("device", sql.NVarChar, v.device ?? null)
      .input("fsType", sql.VarChar, v.fsType ?? null)
      .input("totalGB", sql.Float, num(v.totalGB))
      .input("freeGB", sql.Float, num(v.freeGB))
      .input("usedPercent", sql.Float, num(v.usedPercent))
      .query(`
        INSERT INTO DeviceVolumes (DeviceId, MountPoint, Device, FsType, TotalGB, FreeGB, UsedPercent)
        VALUES (@deviceId, @mountPoint, @device, @fsType, @totalGB, @freeGB, @usedPercent)
      `);
  }

  return NextResponse.json({ ok: true });
}
