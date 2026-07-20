import { getDb } from "./db";
import { classifyDevice } from "./deviceType";
import { parseRouterDurationToSeconds } from "./mikrotikParser";

export interface StaffStatus {
  Id: number;
  Name: string;
  MacAddress: string | null;
  source: "mikrotik" | "sophos" | null;
  currentIp: string | null;
  deviceName: string | null;
  computerNameOverride: string | null;
  os: string | null;
  deviceType: string;
  isOnline: boolean;
  firstSeen: Date | null;
  lastSeen: Date | null;
}

interface StaffRow {
  Id: number;
  Name: string;
  MacAddress: string | null;
  ComputerNameOverride: string | null;
  RouterIp: string | null;
  Hostname: string | null;
  Status: string | null;
  LastSeenRaw: string | null;
  RouterUpdatedAt: string | null;
  Os: string | null;
  RouterFirstSeen: string | null;
  SophosIp: string | null;
  SophosUpdatedAt: string | null;
  SophosHostname: string | null;
  SophosOs: string | null;
  SophosFirstSeen: string | null;
  VendorName: string | null;
}

function lastSeenAt(updatedAt: string | null, lastSeenRaw: string | null): Date | null {
  if (!updatedAt) return null;
  const seconds = parseRouterDurationToSeconds(lastSeenRaw);
  if (seconds === null) return null;
  return new Date(new Date(updatedAt).getTime() - seconds * 1000);
}

function isPollFresh(updatedAt: string | null, staleMinutes = 10): boolean {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() <= staleMinutes * 60 * 1000;
}

// Single source of truth for "is this staff member's device online, and via which network"
// — used by both the Staff page and the Dashboard summary tiles so the two never disagree.
export async function getStaffWithStatus(): Promise<StaffStatus[]> {
  const db = await getDb();

  const staffResult = await db.query<StaffRow>(`
    SELECT s.Id, s.Name, s.MacAddress, s.ComputerNameOverride,
      best.IpAddress AS RouterIp, best.Hostname, best.Status, best.LastSeenRaw, best.UpdatedAt AS RouterUpdatedAt, best.Os,
      best.FirstSeen AS RouterFirstSeen,
      sophosBest.IpAddress AS SophosIp, sophosBest.SophosUpdatedAt, sophosBest.SophosHostname, sophosBest.SophosOs,
      sophosBest.SophosFirstSeen,
      ov.VendorName
    FROM Staff s
    OUTER APPLY (
      SELECT TOP 1 IpAddress, Hostname, Status, LastSeenRaw, UpdatedAt, Os, FirstSeen
      FROM RouterClients rc
      WHERE UPPER(rc.MacAddress) = UPPER(s.MacAddress)
      ORDER BY UpdatedAt DESC
    ) best
    OUTER APPLY (
      SELECT TOP 1 IpAddress, UpdatedAt AS SophosUpdatedAt, Hostname AS SophosHostname, Os AS SophosOs,
        FirstSeen AS SophosFirstSeen
      FROM SophosClients sc
      WHERE UPPER(sc.MacAddress) = UPPER(s.MacAddress)
      ORDER BY UpdatedAt DESC
    ) sophosBest
    LEFT JOIN OuiVendors ov ON ov.Prefix = REPLACE(LEFT(s.MacAddress, 8), ':', '')
    ORDER BY s.Name
  `);

  const activeSophosResult = await db.query<{ SrcIp: string }>(`
    SELECT DISTINCT SrcIp FROM WebFilterLogs WHERE ReceivedAt >= DATEADD(MINUTE, -10, SYSUTCDATETIME())
  `);
  const activeSophosIps = new Set(activeSophosResult.recordset.map((r) => r.SrcIp));

  return staffResult.recordset.map((s) => {
    // If a MAC somehow has recent activity on both networks, prefer whichever was updated most recently.
    const routerTime = s.RouterIp && s.RouterUpdatedAt ? new Date(s.RouterUpdatedAt).getTime() : -Infinity;
    const sophosTime = s.SophosIp && s.SophosUpdatedAt ? new Date(s.SophosUpdatedAt).getTime() : -Infinity;
    const source: "mikrotik" | "sophos" | null =
      routerTime === -Infinity && sophosTime === -Infinity ? null : routerTime >= sophosTime ? "mikrotik" : "sophos";
    const currentIp = source === "mikrotik" ? s.RouterIp : source === "sophos" ? s.SophosIp : null;
    // Classification stays driven by the network-reported hostname (naming conventions like
    // "DESKTOP-", "-iPhone" carry real signal) even when an admin has overridden the
    // displayed name to something arbitrary like "Bob's Desk".
    const autoDeviceName = source === "mikrotik" ? s.Hostname : source === "sophos" ? s.SophosHostname : null;
    const deviceName = s.ComputerNameOverride ?? autoDeviceName;
    const os = source === "mikrotik" ? s.Os : source === "sophos" ? s.SophosOs : null;
    const deviceType = classifyDevice(autoDeviceName, s.VendorName);
    const isOnline =
      source === "mikrotik"
        ? !!s.MacAddress && s.Status === "bound" && isPollFresh(s.RouterUpdatedAt)
        : source === "sophos"
          ? currentIp !== null && activeSophosIps.has(currentIp)
          : false;
    const firstSeenRaw = source === "mikrotik" ? s.RouterFirstSeen : source === "sophos" ? s.SophosFirstSeen : null;
    const firstSeen = firstSeenRaw ? new Date(firstSeenRaw) : null;
    // MikroTik gives a precise "last seen X ago" from the lease; Sophos-side only tells us
    // the device was still in the firewall's ARP table as of its last poll, which is a
    // coarser but still useful last-seen signal.
    const lastSeen =
      source === "mikrotik"
        ? lastSeenAt(s.RouterUpdatedAt, s.LastSeenRaw)
        : source === "sophos" && s.SophosUpdatedAt
          ? new Date(s.SophosUpdatedAt)
          : null;

    return {
      Id: s.Id, Name: s.Name, MacAddress: s.MacAddress, source, currentIp, deviceName,
      computerNameOverride: s.ComputerNameOverride, os, deviceType, isOnline, firstSeen, lastSeen,
    };
  });
}

export function formatDuration(from: Date | null): string {
  if (!from) return "-";
  const ms = Date.now() - from.getTime();
  if (ms < 0) return "-";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
