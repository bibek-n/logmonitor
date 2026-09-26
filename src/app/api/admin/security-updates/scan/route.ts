import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { agentSupportsUpdateScan, MIN_UPDATE_SCAN_AGENT_VERSION, SCAN_MAX_HEARTBEAT_AGE_SECONDS, SCAN_REQUEST_TTL_MINUTES } from "@/lib/securityUpdates/agentSupport";

// Scan All (all: true) or Scan Selected (deviceIds). Read-only on the device: the agent runs its own
// update check on its next heartbeat and reports back. Devices that are offline, or whose agent is too old
// to know about update scans, are skipped with a reason instead of queueing a request nobody will pick up.
const bodySchema = z
  .object({
    all: z.boolean().optional(),
    deviceIds: z.array(z.string().min(1).max(40)).max(500).optional(),
  })
  .refine((b) => b.all === true || (b.deviceIds && b.deviceIds.length > 0), { message: "Choose devices or Scan All" });

export async function POST(req: NextRequest) {
  const su = await requireSecurityUpdatesPermission("su_scan");
  if (!isSecurityUpdatesSession(su)) return su;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Choose devices to scan, or Scan All." }, { status: 400 });
  }
  const { all, deviceIds } = parsed.data;

  const db = await getDb();
  const rq = db.request();
  let where = "OS IN ('windows', 'linux', 'darwin')";
  if (!all) {
    const names = deviceIds!.map((id, i) => {
      rq.input(`d${i}`, sql.VarChar, id);
      return `@d${i}`;
    });
    where = `DeviceId IN (${names.join(",")})`;
  }
  const devices = await rq.query<{ DeviceId: string; Hostname: string; OS: string | null; AgentVersion: string | null; HbAge: number | null }>(
    `SELECT DeviceId, Hostname, OS, AgentVersion, DATEDIFF(SECOND, LastHeartbeat, SYSUTCDATETIME()) AS HbAge FROM Devices WHERE ${where}`
  );

  const queued: string[] = [];
  const skipped: { deviceId: string; hostname: string; reason: string }[] = [];

  for (const d of devices.recordset) {
    if (d.HbAge === null || d.HbAge > SCAN_MAX_HEARTBEAT_AGE_SECONDS) {
      skipped.push({ deviceId: d.DeviceId, hostname: d.Hostname, reason: "Offline - the agent is not reporting" });
      continue;
    }
    if (!agentSupportsUpdateScan(d.AgentVersion)) {
      skipped.push({ deviceId: d.DeviceId, hostname: d.Hostname, reason: `Agent ${d.AgentVersion ?? "unknown"} is too old (needs ${MIN_UPDATE_SCAN_AGENT_VERSION}+)` });
      continue;
    }
    const pending = await db
      .request()
      .input("deviceId", sql.VarChar, d.DeviceId)
      .query("SELECT 1 FROM PendingUpdateRequests WHERE DeviceId = @deviceId AND Kind = 'scan' AND FulfilledAt IS NULL AND ExpiresAt > SYSUTCDATETIME()");
    if (pending.recordset.length > 0) {
      skipped.push({ deviceId: d.DeviceId, hostname: d.Hostname, reason: "A scan is already waiting for this device" });
      continue;
    }

    await db
      .request()
      .input("deviceId", sql.VarChar, d.DeviceId)
      .input("userId", sql.Int, su.userId)
      .input("name", sql.NVarChar, su.username)
      .input("ttl", sql.Int, SCAN_REQUEST_TTL_MINUTES)
      .query(
        "INSERT INTO PendingUpdateRequests (DeviceId, Kind, RequestedByUserId, RequestedByName, ExpiresAt) VALUES (@deviceId, 'scan', @userId, @name, DATEADD(MINUTE, @ttl, SYSUTCDATETIME()))"
      );
    await db
      .request()
      .input("deviceId", sql.VarChar, d.DeviceId)
      .input("hostname", sql.NVarChar, d.Hostname)
      .input("os", sql.VarChar, d.OS)
      .input("userId", sql.Int, su.userId)
      .input("name", sql.NVarChar, su.username)
      .query(
        "INSERT INTO UpdateHistory (DeviceId, Hostname, OS, EventType, Detail, ActorUserId, ActorName) VALUES (@deviceId, @hostname, @os, 'scan_requested', 'Update scan requested from the dashboard', @userId, @name)"
      );
    queued.push(d.DeviceId);
  }

  await logAdminAction({
    admin: su,
    section: "security-updates",
    action: all ? "scan_all" : "scan_selected",
    details: `queued ${queued.length}, skipped ${skipped.length}`,
    req,
  });

  return NextResponse.json({ ok: true, queued: queued.length, skipped });
}
