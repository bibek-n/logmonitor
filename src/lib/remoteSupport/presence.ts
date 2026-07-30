// Same "online" threshold every other part of this app already uses for Devices.LastHeartbeat
// (endpoint-agents list, dashboard KPIs) - kept as one small wrapper here so Remote Support's
// own device-list/online-check call sites read intent ("is this device reachable for a support
// session") rather than repeating the raw threshold arithmetic inline.
const ONLINE_THRESHOLD_MS = 90 * 1000;

export function isDeviceOnline(lastHeartbeat: string | Date | null): boolean {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() < ONLINE_THRESHOLD_MS;
}
