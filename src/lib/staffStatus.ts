import { getDb } from "./db";
import { classifyDevice } from "./deviceType";
import { parseRouterDurationToSeconds } from "./mikrotikParser";

export interface StaffStatus {
  Id: number;
  Name: string;
  MacAddress: string | null;
  EmploymentStatus: string;
  source: "mikrotik" | "sophos" | "agent" | null;
  currentIp: string | null;
  deviceName: string | null;
  computerNameOverride: string | null;
  os: string | null;
  deviceType: string;
  deviceId: string | null;
  isOnline: boolean;
  isRemoteVpn: boolean;
  firstSeen: Date | null;
  lastSeen: Date | null;
}

interface StaffRow {
  Id: number;
  Name: string;
  MacAddress: string | null;
  EmploymentStatus: string;
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
  AgentDeviceIp: string | null;
  AgentHostname: string | null;
  AgentOs: string | null;
  AgentLastHeartbeat: string | null;
  AgentEnrolledAt: string | null;
  AgentDeviceId: string | null;
  AgentVpnActive: boolean | null;
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

// The fields every "is this device online, and via which network" computation needs, shared
// between getStaffWithStatus() below (the Staff list / Dashboard tiles) and the per-employee
// detail page (src/app/dashboard/staff/[id]/page.tsx). The two used to each carry their own
// copy of this logic - the detail page's copy silently reverted to "prefer whichever of
// agent/router/sophos is freshest" instead of "an enrolled agent always wins once one exists"
// the first time someone touched it, which is exactly the stale-agent-reported-online bug this
// file's own history already fixed once (see the "agentTime !== -Infinity" comment below). One
// shared function instead of two independently-evolving copies closes that drift risk for good.
export interface DeviceStatusInputs {
  macAddress: string | null;
  computerNameOverride: string | null;
  routerIp: string | null;
  routerHostname: string | null;
  routerStatus: string | null;
  routerLastSeenRaw: string | null;
  routerUpdatedAt: string | null;
  routerOs: string | null;
  routerFirstSeen: string | null;
  sophosIp: string | null;
  sophosUpdatedAt: string | null;
  sophosHostname: string | null;
  sophosOs: string | null;
  sophosFirstSeen: string | null;
  vendorName: string | null;
  agentDeviceIp: string | null;
  agentHostname: string | null;
  agentOs: string | null;
  agentLastHeartbeat: string | null;
  agentEnrolledAt: string | null;
  agentDeviceId: string | null;
  agentVpnActive: boolean | null;
}

export interface DeviceStatusComputed {
  source: "mikrotik" | "sophos" | "agent" | null;
  currentIp: string | null;
  deviceName: string | null;
  os: string | null;
  deviceType: string;
  deviceId: string | null;
  isOnline: boolean;
  isRemoteVpn: boolean;
  firstSeen: Date | null;
  lastSeen: Date | null;
}

export function computeDeviceStatus(s: DeviceStatusInputs): DeviceStatusComputed {
  const routerTime = s.routerIp && s.routerUpdatedAt ? new Date(s.routerUpdatedAt).getTime() : -Infinity;
  const sophosTime = s.sophosIp && s.sophosUpdatedAt ? new Date(s.sophosUpdatedAt).getTime() : -Infinity;
  // Gated on agentLastHeartbeat alone - NOT also agentDeviceIp. heartbeat/route.ts's clientIp()
  // only reads the x-forwarded-for header and leaves Devices.LastIp NULL if a request ever
  // arrives without one (some reverse-proxy paths don't inject it), which is just missing
  // display metadata, not a sign the agent itself is dead. Requiring agentDeviceIp here too
  // caused a real bug: a device heartbeating live every 30s with LastIp NULL was never
  // recognized as "agent" at all and silently fell back to router/Sophos network presence -
  // which for a months-stale network row made a live, healthy employee read as offline with a
  // months-old last-seen date (found via Abhaya Chaudhary's live-heartbeating ABHAY-PC).
  const agentTime = s.agentLastHeartbeat ? new Date(s.agentLastHeartbeat).getTime() : -Infinity;
  // An enrolled agent is ALWAYS the authoritative source once one exists, whether or not its
  // last heartbeat is still fresh - see getStaffWithStatus's historical comment for why (a
  // dead/crashed agent must not silently fall back to network presence, which only needs the
  // PC plugged in/Wi-Fi-connected, not the agent actually running, to keep looking "online").
  const source: "mikrotik" | "sophos" | "agent" | null =
    agentTime !== -Infinity
      ? "agent"
      : routerTime === -Infinity && sophosTime === -Infinity
        ? null
        : routerTime >= sophosTime
          ? "mikrotik"
          : "sophos";
  const currentIp = source === "mikrotik" ? s.routerIp : source === "sophos" ? s.sophosIp : source === "agent" ? s.agentDeviceIp : null;
  const autoDeviceName = source === "mikrotik" ? s.routerHostname : source === "sophos" ? s.sophosHostname : source === "agent" ? s.agentHostname : null;
  const deviceName = s.computerNameOverride ?? autoDeviceName;
  const os = source === "mikrotik" ? s.routerOs : source === "sophos" ? s.sophosOs : source === "agent" ? s.agentOs : null;
  const deviceType = classifyDevice(autoDeviceName, s.vendorName);
  const deviceId = source === "agent" ? s.agentDeviceId : null;
  const isOnline =
    source === "mikrotik"
      ? !!s.macAddress && s.routerStatus === "bound" && isPollFresh(s.routerUpdatedAt)
      : source === "sophos"
        ? isPollFresh(s.sophosUpdatedAt)
        : source === "agent"
          ? isPollFresh(s.agentLastHeartbeat, AGENT_STALE_MINUTES)
          : false;
  const firstSeenRaw = source === "mikrotik" ? s.routerFirstSeen : source === "sophos" ? s.sophosFirstSeen : source === "agent" ? s.agentEnrolledAt : null;
  const firstSeen = firstSeenRaw ? new Date(firstSeenRaw) : null;
  const lastSeen =
    source === "mikrotik"
      ? lastSeenAt(s.routerUpdatedAt, s.routerLastSeenRaw)
      : source === "sophos" && s.sophosUpdatedAt
        ? new Date(s.sophosUpdatedAt)
        : source === "agent" && s.agentLastHeartbeat
          ? new Date(s.agentLastHeartbeat)
          : null;
  // Last known network snapshot said this device was tunneling in over VPN (e.g. a remote
  // employee's laptop) - kept regardless of whether the agent is currently online, so an
  // employee who simply isn't connected to the VPN right now still reads as "offline, but
  // normally remote" instead of looking identical to a genuinely dead/crashed agent on an
  // office LAN machine. See Trilokesh Roy's case (DeviceNetworkInfo.VpnActive).
  const isRemoteVpn = !!s.agentDeviceId && s.agentVpnActive === true;

  return { source, currentIp, deviceName, os, deviceType, deviceId, isOnline, isRemoteVpn, firstSeen, lastSeen };
}

// See the comment at the isOnline computation below for why this is tighter than the
// network-poll branches' default 10-minute window. Widened from an initial 2 minutes after
// live observation during a real SQL Server contention incident (deadlocks/timeouts on the
// shared TulipsHRMDev instance) showed heartbeat writes themselves getting delayed by 10-20
// minutes for devices that were genuinely online the whole time - 2 minutes was too tight to
// absorb that kind of server-side delay without falsely flipping to offline. 5 minutes (~10
// missed 30s beats) still catches a truly dead agent far faster than the old 10-minute
// network-poll window, while tolerating this class of transient server-side hiccup.
const AGENT_STALE_MINUTES = 5;

// Single source of truth for "is this staff member's device online, and via which network"
// — used by both the Staff page and the Dashboard summary tiles so the two never disagree.
export async function getStaffWithStatus(): Promise<StaffStatus[]> {
  const db = await getDb();

  const staffResult = await db.query<StaffRow>(`
    SELECT s.Id, s.Name, s.MacAddress, s.EmploymentStatus, s.ComputerNameOverride,
      best.IpAddress AS RouterIp, best.Hostname, best.Status, best.LastSeenRaw, best.UpdatedAt AS RouterUpdatedAt, best.Os,
      best.FirstSeen AS RouterFirstSeen,
      sophosBest.IpAddress AS SophosIp, sophosBest.SophosUpdatedAt, sophosBest.SophosHostname, sophosBest.SophosOs,
      sophosBest.SophosFirstSeen,
      ov.VendorName,
      agentBest.AgentDeviceIp, agentBest.AgentHostname, agentBest.AgentOs, agentBest.AgentLastHeartbeat, agentBest.AgentEnrolledAt,
      agentBest.AgentDeviceId, agentBest.AgentVpnActive
    FROM Staff s
    OUTER APPLY (
      SELECT TOP 1 IpAddress, Hostname, Status, LastSeenRaw, UpdatedAt, Os, FirstSeen
      FROM RouterClients rc
      WHERE rc.MacAddress = s.MacAddress
      ORDER BY UpdatedAt DESC
    ) best
    OUTER APPLY (
      SELECT TOP 1 IpAddress, UpdatedAt AS SophosUpdatedAt, Hostname AS SophosHostname, Os AS SophosOs,
        FirstSeen AS SophosFirstSeen
      FROM SophosClients sc
      WHERE sc.MacAddress = s.MacAddress
      ORDER BY UpdatedAt DESC
    ) sophosBest
    -- Direct-enrollment employees (agent installed via a staff-scoped enrollment token,
    -- e.g. a device on a routed VLAN the MikroTik/Sophos pollers never see at all - see
    -- Rahul Singh's Ubuntu desktop) have a real Devices.StaffId FK link, entirely
    -- independent of the MAC-matching the two APPLYs above rely on. Without this, such an
    -- employee shows offline forever even with a perfectly healthy agent, since nothing
    -- about their device ever appears in RouterClients/SophosClients.
    OUTER APPLY (
      SELECT TOP 1 d.LastIp AS AgentDeviceIp, d.Hostname AS AgentHostname, d.OS AS AgentOs,
        d.LastHeartbeat AS AgentLastHeartbeat, d.EnrolledAt AS AgentEnrolledAt, d.DeviceId AS AgentDeviceId,
        dni.VpnActive AS AgentVpnActive
      FROM Devices d
      LEFT JOIN DeviceNetworkInfo dni ON dni.DeviceId = d.DeviceId
      WHERE d.StaffId = s.Id
      ORDER BY d.LastHeartbeat DESC
    ) agentBest
    LEFT JOIN OuiVendors ov ON ov.Prefix = REPLACE(LEFT(s.MacAddress, 8), ':', '')
    ORDER BY s.Name
  `);

  return staffResult.recordset.map((s) => {
    const computed = computeDeviceStatus({
      macAddress: s.MacAddress,
      computerNameOverride: s.ComputerNameOverride,
      routerIp: s.RouterIp,
      routerHostname: s.Hostname,
      routerStatus: s.Status,
      routerLastSeenRaw: s.LastSeenRaw,
      routerUpdatedAt: s.RouterUpdatedAt,
      routerOs: s.Os,
      routerFirstSeen: s.RouterFirstSeen,
      sophosIp: s.SophosIp,
      sophosUpdatedAt: s.SophosUpdatedAt,
      sophosHostname: s.SophosHostname,
      sophosOs: s.SophosOs,
      sophosFirstSeen: s.SophosFirstSeen,
      vendorName: s.VendorName,
      agentDeviceIp: s.AgentDeviceIp,
      agentHostname: s.AgentHostname,
      agentOs: s.AgentOs,
      agentLastHeartbeat: s.AgentLastHeartbeat,
      agentEnrolledAt: s.AgentEnrolledAt,
      agentDeviceId: s.AgentDeviceId,
      agentVpnActive: s.AgentVpnActive,
    });

    return {
      Id: s.Id, Name: s.Name, MacAddress: s.MacAddress, EmploymentStatus: s.EmploymentStatus,
      computerNameOverride: s.ComputerNameOverride, ...computed,
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
