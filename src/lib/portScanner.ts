import net from "net";
import dgram from "dgram";

// Runs entirely from this server - a plain userland TCP connect scan (no raw sockets, so no
// elevated privileges needed) plus a best-effort UDP probe. Reachability differs by target:
// an internal 192.168.x address is scanned directly over the LAN this server sits on, an
// external address over this server's own internet egress - same "run from this server, so
// results reflect what this server can reach" caveat every other tool in networkTools.ts
// already carries.

const MAX_PORTS = 1000; // keeps a single scan within a reasonable request lifetime
const MAX_CONCURRENCY = 60;
const DEFAULT_TCP_TIMEOUT_MS = 700;
const DEFAULT_UDP_TIMEOUT_MS = 1200; // UDP has no handshake to confirm receipt, so it needs longer to distinguish "no reply yet" from "truly nothing coming"
const BANNER_TIMEOUT_MS = 1500;
const MAX_BANNER_BYTES = 200;

export type ScanProtocol = "tcp" | "udp";
export type PortState = "open" | "closed" | "filtered" | "open|filtered";

export interface PortResult {
  port: number;
  protocol: ScanProtocol;
  state: PortState;
  service: string;
  banner: string | null;
}

// Well-known ports with service names, used both for the "Top 20"/"Common" presets and to
// label any custom port with a best-guess service name in the results table.
const TCP_SERVICE_NAMES: Record<number, string> = {
  21: "ftp", 22: "ssh", 23: "telnet", 25: "smtp", 53: "dns", 80: "http", 110: "pop3",
  111: "rpcbind", 135: "msrpc", 139: "netbios-ssn", 143: "imap", 389: "ldap", 443: "https",
  445: "microsoft-ds", 465: "smtps", 587: "submission", 993: "imaps", 995: "pop3s",
  1433: "mssql", 1521: "oracle", 1723: "pptp", 2049: "nfs", 3000: "http-alt", 3306: "mysql",
  3389: "ms-wbt-server", 5432: "postgresql", 5900: "vnc", 5985: "winrm", 6379: "redis",
  8080: "http-proxy", 8443: "https-alt", 9000: "http-alt", 9200: "elasticsearch", 27017: "mongodb",
};
const UDP_SERVICE_NAMES: Record<number, string> = {
  53: "dns", 67: "dhcp-server", 68: "dhcp-client", 69: "tftp", 123: "ntp", 137: "netbios-ns",
  138: "netbios-dgm", 161: "snmp", 162: "snmptrap", 500: "isakmp", 514: "syslog", 520: "rip",
  1900: "ssdp", 4500: "ipsec-nat-t", 5353: "mdns",
};

export const TOP_20_TCP_PORTS = [21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 1433, 3306, 3389, 5900, 8080];
export const COMMON_TCP_PORTS = Object.keys(TCP_SERVICE_NAMES).map(Number).sort((a, b) => a - b);
export const COMMON_UDP_PORTS = Object.keys(UDP_SERVICE_NAMES).map(Number).sort((a, b) => a - b);

function serviceNameFor(protocol: ScanProtocol, port: number): string {
  return (protocol === "tcp" ? TCP_SERVICE_NAMES[port] : UDP_SERVICE_NAMES[port]) ?? "-";
}

// Accepts "22,80,443" and "8000-8100", mixed and comma-separated; dedupes, sorts, and caps at
// MAX_PORTS so a typo like "1-65535" can't turn one scan into a multi-hour job.
export function parsePortSpec(spec: string): number[] {
  const ports = new Set<number>();
  for (const part of spec.split(",").map((p) => p.trim()).filter(Boolean)) {
    const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end > 65535 || start > end) throw new Error(`Invalid port range: ${part}`);
      for (let p = start; p <= end && ports.size < MAX_PORTS; p++) ports.add(p);
    } else {
      const p = Number(part);
      if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error(`Invalid port: ${part}`);
      ports.add(p);
    }
  }
  if (ports.size === 0) throw new Error("No valid ports specified.");
  if (ports.size > MAX_PORTS) throw new Error(`Too many ports (max ${MAX_PORTS} per scan).`);
  return [...ports].sort((a, b) => a - b);
}

// TCP connect scan: a full three-way handshake completing means open; ECONNREFUSED means
// closed (something answered but nothing's listening); a timeout with no response at all
// means filtered (a firewall is silently dropping the SYN, the classic nmap "filtered" case).
function scanTcpPort(host: string, port: number, timeoutMs: number): Promise<PortState> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (state: PortState) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(state);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish("open"));
    socket.once("timeout", () => finish("filtered"));
    socket.once("error", (err: NodeJS.ErrnoException) => finish(err.code === "ECONNREFUSED" ? "closed" : "filtered"));
    socket.connect(port, host);
  });
}

// UDP is connectionless, so there's no handshake to confirm anything - an ICMP Port
// Unreachable coming back means closed; getting any UDP reply back means open; silence within
// the timeout is the inherent "open|filtered" ambiguity every UDP scanner (including nmap)
// reports, since a dropped probe and a service that just doesn't reply to garbage look
// identical from here.
function scanUdpPort(host: string, port: number, timeoutMs: number): Promise<PortState> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let settled = false;
    const finish = (state: PortState) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(state);
    };
    const timer = setTimeout(() => finish("open|filtered"), timeoutMs);
    socket.once("message", () => finish("open"));
    socket.once("error", (err: NodeJS.ErrnoException) => finish(err.code === "ECONNREFUSED" ? "closed" : "open|filtered"));
    socket.send(Buffer.from([0]), port, host, (err) => {
      if (err) finish("open|filtered");
    });
  });
}

// Sends a protocol-appropriate nudge for ports that stay silent until spoken to (HTTP), then
// reads whatever comes back first - many services (SSH, FTP, SMTP) volunteer a banner
// immediately on connect with no probe needed, so the HTTP nudge only fires for those specific
// ports.
function grabBanner(host: string, port: number): Promise<string | null> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let data = "";
    let settled = false;
    const finish = (result: string | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(BANNER_TIMEOUT_MS);
    socket.once("connect", () => {
      if ([80, 8080, 8000, 3000, 9000].includes(port)) {
        socket.write(`HEAD / HTTP/1.0\r\nHost: ${host}\r\n\r\n`);
      } else if ([443, 8443].includes(port)) {
        // A raw HEAD over plain TCP won't complete a TLS handshake, so there's nothing
        // meaningful to send here - the port is already confirmed open, this just skips
        // straight to "no banner available for TLS ports" rather than sending bytes a TLS
        // listener will just ignore and time out on.
        finish(null);
      }
    });
    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
      if (data.length >= MAX_BANNER_BYTES) finish(data.slice(0, MAX_BANNER_BYTES).trim());
    });
    socket.once("timeout", () => finish(data.trim() || null));
    socket.once("error", () => finish(null));
    socket.once("close", () => finish(data.trim() || null));
    socket.connect(port, host);
  });
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface PortScanOptions {
  protocol: ScanProtocol;
  ports: number[];
  grabBanners: boolean;
}

export async function runPortScan(target: string, opts: PortScanOptions): Promise<PortResult[]> {
  return mapWithConcurrency(opts.ports, MAX_CONCURRENCY, async (port) => {
    const state =
      opts.protocol === "tcp"
        ? await scanTcpPort(target, port, DEFAULT_TCP_TIMEOUT_MS)
        : await scanUdpPort(target, port, DEFAULT_UDP_TIMEOUT_MS);
    const banner = opts.protocol === "tcp" && opts.grabBanners && state === "open" ? await grabBanner(target, port) : null;
    return { port, protocol: opts.protocol, state, service: serviceNameFor(opts.protocol, port), banner };
  });
}

export function formatScanResults(target: string, category: "internal" | "external", results: PortResult[], elapsedMs: number): string {
  const open = results.filter((r) => r.state === "open" || r.state === "open|filtered");
  const lines = [
    `Port scan of ${target} (${category}) - ${results.length} port(s) in ${(elapsedMs / 1000).toFixed(1)}s`,
    `${open.length} open/open|filtered, ${results.length - open.length} closed/filtered`,
    "",
    "PORT     PROTO  STATE          SERVICE         BANNER",
  ];
  for (const r of results) {
    const bannerCol = r.banner ? r.banner.split(/\r?\n/)[0].slice(0, 60) : "-";
    lines.push(
      `${String(r.port).padEnd(8)} ${r.protocol.padEnd(6)} ${r.state.padEnd(14)} ${r.service.padEnd(15)} ${bannerCol}`
    );
  }
  return lines.join("\n");
}
