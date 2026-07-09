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

// Parses the plain "key: value" block RouterOS prints for non-terse `print` commands
// (e.g. `/system resource print`, `/system health print`) — one field per line, colon
// after the key, arbitrary leading whitespace before it.
function parseKeyValueBlock(output: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of output.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fields[key] = value;
  }
  return fields;
}

function parseSizeToMB(v: string | undefined): number | null {
  if (!v) return null;
  const match = /^([\d.]+)\s*(KiB|MiB|GiB)$/i.exec(v.trim());
  if (!match) return null;
  const value = Number(match[1]);
  switch (match[2].toLowerCase()) {
    case "kib":
      return value / 1024;
    case "mib":
      return value;
    case "gib":
      return value * 1024;
    default:
      return null;
  }
}

function parsePercent(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace("%", ""));
  return Number.isNaN(n) ? null : n;
}

export interface RouterResource {
  uptimeSeconds: number | null;
  version: string | null;
  boardName: string | null;
  cpuLoadPct: number | null;
  cpuCount: number | null;
  cpuFrequencyMhz: number | null;
  freeMemoryMB: number | null;
  totalMemoryMB: number | null;
  freeDiskMB: number | null;
  totalDiskMB: number | null;
}

// Parses `/system resource print` output — RouterOS-version-agnostic best-effort: every
// field is independently optional since exact fields available vary slightly by board.
export function parseSystemResource(output: string): RouterResource {
  const f = parseKeyValueBlock(output);
  const freqMatch = f["cpu-frequency"] ? /^([\d.]+)/.exec(f["cpu-frequency"]) : null;
  return {
    uptimeSeconds: parseRouterDurationToSeconds(f.uptime ?? null),
    version: f.version ?? null,
    boardName: f["board-name"] ?? null,
    cpuLoadPct: parsePercent(f["cpu-load"]),
    cpuCount: f["cpu-count"] ? Number(f["cpu-count"]) : null,
    cpuFrequencyMhz: freqMatch ? Number(freqMatch[1]) : null,
    freeMemoryMB: parseSizeToMB(f["free-memory"]),
    totalMemoryMB: parseSizeToMB(f["total-memory"]),
    freeDiskMB: parseSizeToMB(f["free-hdd-space"]),
    totalDiskMB: parseSizeToMB(f["total-hdd-space"]),
  };
}

export interface RouterHealth {
  voltage: number | null;
  temperature: number | null;
}

// Parses `/system health print` — voltage/temperature reporting depends on the specific
// hardware having the sensors at all, so both are nullable, not an error when absent.
export function parseSystemHealth(output: string): RouterHealth {
  const f = parseKeyValueBlock(output);
  const voltageMatch = f.voltage ? /^([\d.]+)/.exec(f.voltage) : null;
  const tempMatch = f.temperature ? /^([\d.]+)/.exec(f.temperature) : null;
  return {
    voltage: voltageMatch ? Number(voltageMatch[1]) : null,
    temperature: tempMatch ? Number(tempMatch[1]) : null,
  };
}

const ROUTEROS_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Parses RouterOS's "mon/dd/yyyy hh:mm:ss" timestamp format (e.g. "jul/09/2026 18:02:21"),
// as seen in `last-link-up-time` and `/user active print` output.
export function parseRouterOsTimestamp(s: string | undefined): Date | null {
  if (!s) return null;
  const m = /^(\w{3})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const month = ROUTEROS_MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(m[3]), month, Number(m[2]), Number(m[4]), Number(m[5]), Number(m[6]));
}

// Splits a terse `print terse` line into its leading "<index> <flags>" prefix and the
// key=value body — the first token containing "=" marks where the body starts. Used by
// both interface and active-user terse parsing (and already informally by DHCP lease
// parsing, which has no flags column so doesn't need this split).
function splitTerseLine(line: string): { flags: string; fields: Record<string, string> } {
  const kvStart = line.search(/\S+=/);
  const prefix = kvStart === -1 ? line : line.slice(0, kvStart);
  const body = kvStart === -1 ? "" : line.slice(kvStart);
  const flags = prefix.replace(/^\s*\d+\s*/, "").trim();

  const fields: Record<string, string> = {};
  const kv = /(\S+?)=(?:"([^"]*)"|(\S*))/g;
  let m: RegExpExecArray | null;
  while ((m = kv.exec(body)) !== null) {
    fields[m[1]] = m[2] !== undefined ? m[2] : m[3] ?? "";
  }
  return { flags, fields };
}

export interface InterfaceStatus {
  name: string;
  defaultName: string | null;
  type: string | null;
  running: boolean;
  disabled: boolean;
  slave: boolean;
  mtu: string | null;
  macAddress: string | null;
  comment: string | null;
  lastLinkUpTime: Date | null;
  lastLinkDownTime: Date | null;
  linkDowns: number | null;
}

// last-link-up-time/last-link-down-time are unquoted values containing a space
// ("last-link-up-time=jul/09/2026 16:57:18"), same tokenizer gap as `when=` above —
// extracted directly from the raw line rather than trusting splitTerseLine's fields map.
const LAST_LINK_UP_REGEX = /\blast-link-up-time=(\w{3}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/;
const LAST_LINK_DOWN_REGEX = /\blast-link-down-time=(\w{3}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/;

// Parses `/interface print terse` — every physical/logical interface (ether ports, the
// internet_port bridge, unused sfp, etc.), including flags (R=running, S=slave/bridge
// member, X=disabled) and link-flap history, which is genuinely useful health signal
// (e.g. an interface with 70 link-downs indicates a flaky physical connection).
export function parseInterfaceList(output: string): InterfaceStatus[] {
  const results: InterfaceStatus[] = [];
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const { flags, fields } = splitTerseLine(line);
    if (!fields.name) continue;

    const upMatch = LAST_LINK_UP_REGEX.exec(line);
    const downMatch = LAST_LINK_DOWN_REGEX.exec(line);

    results.push({
      name: fields.name,
      defaultName: fields["default-name"] ?? null,
      type: fields.type ?? null,
      running: flags.includes("R"),
      disabled: flags.includes("X"),
      slave: flags.includes("S"),
      mtu: fields.mtu ?? null,
      macAddress: fields["mac-address"] ?? null,
      comment: fields.comment ?? null,
      lastLinkUpTime: upMatch ? parseRouterOsTimestamp(upMatch[1]) : null,
      lastLinkDownTime: downMatch ? parseRouterOsTimestamp(downMatch[1]) : null,
      linkDowns: fields["link-downs"] ? Number(fields["link-downs"]) : null,
    });
  }
  return results;
}

export interface ActiveUser {
  name: string;
  address: string | null;
  via: string | null;
  loginTime: Date | null;
}

// Parses `/user active print terse` — who's currently logged into the router itself
// (admin/API/ssh sessions), a meaningful security/health signal distinct from DHCP
// clients (which are network devices, not router management sessions).
// `when=` is the one field here whose value isn't quoted and contains a space
// ("when=jul/09/2026 18:02:21 name=admin ..."), which breaks the generic
// splitTerseLine/KV tokenizer (it treats unquoted values as single whitespace-delimited
// tokens, so "18:02:21" gets silently dropped since it has no "="). Extracted directly
// from the raw line instead, sidestepping that tokenizer assumption for this one field.
const WHEN_REGEX = /\bwhen=(\w{3}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/;

export function parseActiveUsers(output: string): ActiveUser[] {
  const results: ActiveUser[] = [];
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const { fields } = splitTerseLine(line);
    if (!fields.name) continue;
    const whenMatch = WHEN_REGEX.exec(line);
    results.push({
      name: fields.name,
      address: fields.address ?? null,
      via: fields.via ?? null,
      loginTime: whenMatch ? parseRouterOsTimestamp(whenMatch[1]) : null,
    });
  }
  return results;
}
