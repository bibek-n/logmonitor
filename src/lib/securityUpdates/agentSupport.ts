// First agent release that reports Security & Updates scans and understands
// heartbeat.pendingUpdateRequests (agent/updates.go). An older agent would silently ignore a queued
// scan request, so it must never be sent one.
export const MIN_UPDATE_SCAN_AGENT_VERSION = "0.17.0";

// Approved installs (agent/updates_install.go) ship in the same release as scans.
export const MIN_UPDATE_INSTALL_AGENT_VERSION = "0.17.0";

function parseVersion(v: string | null | undefined): number[] | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v ?? "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function atLeast(agentVersion: string | null | undefined, min: string): boolean {
  const have = parseVersion(agentVersion);
  const need = parseVersion(min)!;
  if (!have) return false;
  for (let i = 0; i < 3; i++) {
    if (have[i] !== need[i]) return have[i] > need[i];
  }
  return true;
}

export function agentSupportsUpdateScan(agentVersion: string | null | undefined): boolean {
  return atLeast(agentVersion, MIN_UPDATE_SCAN_AGENT_VERSION);
}

export function agentSupportsUpdateInstall(agentVersion: string | null | undefined): boolean {
  return atLeast(agentVersion, MIN_UPDATE_INSTALL_AGENT_VERSION);
}

// The agent reports runtime.GOOS: "windows" | "linux" | "darwin". Human names for the UI.
export function osLabel(os: string | null | undefined): string {
  switch ((os ?? "").toLowerCase()) {
    case "windows":
      return "Windows";
    case "linux":
      return "Linux";
    case "darwin":
      return "macOS";
    default:
      return os ?? "Unknown";
  }
}

// A device counts as reachable for a scan request if its agent heartbeated in the last few minutes.
export const SCAN_MAX_HEARTBEAT_AGE_SECONDS = 300;
export const SCAN_REQUEST_TTL_MINUTES = 30;
