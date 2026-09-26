import os from "os";
import { getDb, sql } from "@/lib/db";

// First agent release that understands heartbeat.pendingWakeRequests / /api/agent/wake-ack
// (agent/wakerelay.go). An older agent would silently ignore a queued request, so it must
// never be picked as a relay.
export const MIN_WAKE_RELAY_AGENT_VERSION = "0.16.0";

// Long enough to survive a couple of missed heartbeats, short enough that a request for a
// machine that has since been powered on some other way doesn't fire a stale magic packet
// hours later.
const REQUEST_TTL_MINUTES = 10;
const MAX_RELAYS_PER_REQUEST = 2;
const RELAY_MAX_HEARTBEAT_AGE_SECONDS = 180;

function parseVersion(v: string | null | undefined): number[] | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v ?? "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function agentSupportsWakeRelay(agentVersion: string | null | undefined): boolean {
  const have = parseVersion(agentVersion);
  const need = parseVersion(MIN_WAKE_RELAY_AGENT_VERSION)!;
  if (!have) return false;
  for (let i = 0; i < 3; i++) {
    if (have[i] !== need[i]) return have[i] > need[i];
  }
  return true;
}

// Assumes /24 networks, which is how every LAN segment here is laid out - two hosts are "on
// the same segment" when their first three octets match.
export function subnetPrefix(ip: string | null | undefined): string | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec((ip ?? "").trim());
  return m ? `${m[1]}.${m[2]}.${m[3]}.` : null;
}

export function isOnServerSubnet(ip: string | null | undefined): boolean {
  const prefix = subnetPrefix(ip);
  if (!prefix) return false;
  return Object.values(os.networkInterfaces())
    .flat()
    .some((n) => n && n.family === "IPv4" && !n.internal && subnetPrefix(n.address) === prefix);
}

export interface QueuedRelay {
  deviceId: string;
  hostname: string;
}

// Queues a wake request against up to MAX_RELAYS_PER_REQUEST online, wake-capable agents on the
// target's own /24. Servers are preferred (they're rarely the machine that's off), then the most
// recently heard-from. Returns the relays actually queued - empty means nobody on that segment
// can relay.
export async function queueWakeRelays(opts: {
  targetDeviceId: string;
  targetMac: string;
  targetIp: string;
  requestedByUserId: number | null;
}): Promise<QueuedRelay[]> {
  const prefix = subnetPrefix(opts.targetIp);
  if (!prefix) return [];

  const db = await getDb();
  const candidates = await db
    .request()
    .input("targetDeviceId", sql.VarChar, opts.targetDeviceId)
    .input("prefix", sql.VarChar, `${prefix}%`)
    .input("maxAge", sql.Int, RELAY_MAX_HEARTBEAT_AGE_SECONDS)
    .query<{ DeviceId: string; Hostname: string; AgentVersion: string | null }>(`
      SELECT DeviceId, Hostname, AgentVersion FROM Devices
      WHERE DeviceId <> @targetDeviceId
        AND LastHeartbeat IS NOT NULL
        AND DATEDIFF(SECOND, LastHeartbeat, SYSUTCDATETIME()) < @maxAge
        AND COALESCE(StaticIpAddress, LastIp) LIKE @prefix
      ORDER BY CASE WHEN DeviceType = 'Server' THEN 0 ELSE 1 END, LastHeartbeat DESC
    `);

  const relays = candidates.recordset.filter((c) => agentSupportsWakeRelay(c.AgentVersion)).slice(0, MAX_RELAYS_PER_REQUEST);
  for (const relay of relays) {
    await db
      .request()
      .input("relayDeviceId", sql.VarChar, relay.DeviceId)
      .input("targetDeviceId", sql.VarChar, opts.targetDeviceId)
      .input("targetMac", sql.VarChar, opts.targetMac)
      .input("requestedByUserId", sql.Int, opts.requestedByUserId)
      .input("ttl", sql.Int, REQUEST_TTL_MINUTES)
      .query(`
        INSERT INTO PendingWakeRequests (RelayDeviceId, TargetDeviceId, TargetMac, RequestedByUserId, ExpiresAt)
        VALUES (@relayDeviceId, @targetDeviceId, @targetMac, @requestedByUserId, DATEADD(MINUTE, @ttl, SYSUTCDATETIME()))
      `);
  }
  return relays.map((r) => ({ deviceId: r.DeviceId, hostname: r.Hostname }));
}
