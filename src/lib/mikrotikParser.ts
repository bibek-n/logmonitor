const FACILITIES = [
  "kern", "user", "mail", "daemon", "auth", "syslog", "lpr", "news",
  "uucp", "cron", "authpriv", "ftp", "ntp", "audit", "alert", "clock",
  "local0", "local1", "local2", "local3", "local4", "local5", "local6", "local7",
];

const SEVERITIES = [
  "emergency", "alert", "critical", "error", "warning", "notice", "info", "debug",
];

export interface ParsedRouterLog {
  deviceTimestamp: Date | null;
  hostname: string | null;
  facility: string | null;
  severity: string | null;
  message: string | null;
}

const BSD_SYSLOG_REGEX = /^<(\d+)>(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([\s\S]*)$/;

export function parseMikrotikLog(raw: string): ParsedRouterLog {
  const match = BSD_SYSLOG_REGEX.exec(raw.trim());
  if (!match) {
    return { deviceTimestamp: null, hostname: null, facility: null, severity: null, message: raw.trim() };
  }

  const [, pri, ts, hostname, message] = match;
  const priNum = Number(pri);
  const facility = FACILITIES[Math.floor(priNum / 8)] ?? null;
  const severity = SEVERITIES[priNum % 8] ?? null;

  // BSD syslog timestamps have no year — attach the current year.
  const now = new Date();
  const withYear = `${ts} ${now.getFullYear()}`;
  const parsed = new Date(withYear);
  const deviceTimestamp = Number.isNaN(parsed.getTime()) ? null : parsed;

  return { deviceTimestamp, hostname, facility, severity, message };
}

export interface ParsedWebConn {
  srcIp: string | null;
  srcPort: number | null;
  srcMac: string | null;
  dstIp: string | null;
  dstPort: number | null;
  protocol: string | null;
}

const WEBCONN_REGEX =
  /src-mac\s+([0-9a-fA-F:]+),\s*proto\s+(\w+).*?(\d+\.\d+\.\d+\.\d+):(\d+)->(\d+\.\d+\.\d+\.\d+):(\d+)/;

export function isWebConnMessage(message: string | null): boolean {
  return !!message && message.startsWith("WEBCONN:");
}

export function parseWebConn(message: string): ParsedWebConn {
  const match = WEBCONN_REGEX.exec(message);
  if (!match) {
    return { srcIp: null, srcPort: null, srcMac: null, dstIp: null, dstPort: null, protocol: null };
  }
  const [, srcMac, protocol, srcIp, srcPort, dstIp, dstPort] = match;
  return {
    srcIp,
    srcPort: Number(srcPort),
    srcMac,
    dstIp,
    dstPort: Number(dstPort),
    protocol,
  };
}

function parseRateToMbps(rate: string): number | null {
  const match = /^([\d.]+)(Gbps|Mbps|kbps|bps)$/.exec(rate.trim());
  if (!match) return null;
  const value = Number(match[1]);
  switch (match[2]) {
    case "Gbps":
      return value * 1000;
    case "Mbps":
      return value;
    case "kbps":
      return value / 1000;
    case "bps":
      return value / 1_000_000;
    default:
      return null;
  }
}

export interface InterfaceRate {
  interface: string | null;
  rxMbps: number | null;
  txMbps: number | null;
}

// Parses `/interface monitor-traffic interface=X once` output for a SINGLE interface.
// Querying multiple interfaces at once produces a multi-column layout that can
// misalign under terminal-width wrapping, so this is called once per interface.
export function parseMonitorTraffic(output: string): InterfaceRate {
  const lines = output.split("\n");
  const nameLine = lines.find((l) => l.trim().startsWith("name:"));
  const rxLine = lines.find((l) => l.trim().startsWith("rx-bits-per-second:"));
  const txLine = lines.find((l) => l.trim().startsWith("tx-bits-per-second:"));

  const iface = nameLine ? nameLine.split(":")[1].trim() : null;
  const rx = rxLine ? parseRateToMbps(rxLine.split(":")[1].trim()) : null;
  const tx = txLine ? parseRateToMbps(txLine.split(":")[1].trim()) : null;

  return { interface: iface, rxMbps: rx, txMbps: tx };
}

// Parses RouterOS relative duration strings like "3m5s", "1h2m3s", "45s", "2d3h" into seconds.
export function parseRouterDurationToSeconds(duration: string | null): number | null {
  if (!duration) return null;
  const match = duration.match(/(\d+)([wdhms])/g);
  if (!match) return null;
  const unitSeconds: Record<string, number> = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
  let total = 0;
  for (const part of match) {
    const unit = part.slice(-1);
    const value = Number(part.slice(0, -1));
    total += value * (unitSeconds[unit] ?? 0);
  }
  return total;
}
