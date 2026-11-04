import { execFile } from "child_process";
import { promisify } from "util";
import dns from "dns";
import http from "http";
import https from "https";
import { checkLiteralIpNotRestricted, createSafeLookup, SsrfBlockedError } from "./websiteApiMonitoring/ssrfGuard";

const execFileAsync = promisify(execFile);
const dnsPromises = dns.promises;

const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

// Strict allowlist so a target string can never be interpreted as anything but a plain
// hostname/domain or IP — used to gate both the ping/tracert child processes (run via
// execFile with an argument array, never a shell) and the DNS server override field.
export function isValidTarget(target: string): boolean {
  if (!target || target.length > 253) return false;
  if (IPV4_RE.test(target)) {
    return target.split(".").every((o) => Number(o) <= 255);
  }
  if (target.includes(":")) {
    return IPV6_RE.test(target);
  }
  return HOSTNAME_RE.test(target);
}

function isIpTarget(target: string): boolean {
  return IPV4_RE.test(target) || target.includes(":");
}

async function execRaw(command: string, args: string[], timeout: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout });
    return stdout;
  } catch (err) {
    const e = err as { stdout?: string; message: string };
    return e.stdout || e.message;
  }
}

export async function runPing(target: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("ping", ["-n", "4", target], { timeout: 15000 });
    return stdout;
  } catch (err) {
    const e = err as { stdout?: string; message: string };
    return e.stdout || e.message;
  }
}

export async function runTraceroute(target: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("tracert", ["-h", "20", "-w", "1000", target], { timeout: 30000 });
    return stdout;
  } catch (err) {
    const e = err as { stdout?: string; message: string };
    return e.stdout || e.message;
  }
}

export async function hostLookup(target: string): Promise<string> {
  const lines: string[] = [];
  if (isIpTarget(target)) {
    try {
      const names = await dnsPromises.reverse(target);
      if (names.length === 0) lines.push(`${target} has no reverse DNS (PTR) record.`);
      else names.forEach((n) => lines.push(`${target} points to ${n}`));
    } catch (err) {
      lines.push(`${target}: reverse lookup failed (${(err as Error).message})`);
    }
  } else {
    try {
      const addrs = await dnsPromises.lookup(target, { all: true });
      addrs.forEach((a) => lines.push(`${target} has address ${a.address} (IPv${a.family})`));
    } catch (err) {
      lines.push(`${target}: lookup failed (${(err as Error).message})`);
    }
  }
  return lines.join("\n");
}

const DNS_CHECK_TYPES = ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA"] as const;

function formatRecord(r: unknown): string {
  if (typeof r === "string") return r;
  if (Array.isArray(r)) return r.join("");
  return JSON.stringify(r);
}

export async function dnsCheck(domain: string): Promise<string> {
  const lines: string[] = [`DNS records for ${domain}:`, ""];
  for (const type of DNS_CHECK_TYPES) {
    lines.push(`${type}:`);
    try {
      let records: unknown[];
      switch (type) {
        case "A":
          records = await dnsPromises.resolve4(domain);
          break;
        case "AAAA":
          records = await dnsPromises.resolve6(domain);
          break;
        case "MX":
          records = await dnsPromises.resolveMx(domain);
          break;
        case "TXT":
          records = await dnsPromises.resolveTxt(domain);
          break;
        case "NS":
          records = await dnsPromises.resolveNs(domain);
          break;
        case "CNAME":
          records = await dnsPromises.resolveCname(domain);
          break;
        case "SOA":
          records = [await dnsPromises.resolveSoa(domain)];
          break;
      }
      if (records.length === 0) lines.push("  (none)");
      else records.forEach((r) => lines.push(`  ${formatRecord(r)}`));
    } catch {
      lines.push("  (none)");
    }
    lines.push("");
  }
  return lines.join("\n");
}

export const NSLOOKUP_RECORD_TYPES = ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "PTR"];

export async function nslookup(target: string, recordType: string, server?: string): Promise<string> {
  const resolver = new dns.promises.Resolver();
  if (server) {
    if (!isValidTarget(server)) throw new Error("Invalid DNS server address");
    resolver.setServers([server]);
  }

  if (recordType === "PTR") {
    if (!isIpTarget(target)) throw new Error("PTR lookups require an IP address target");
    const names = await resolver.reverse(target);
    return names.length > 0 ? names.map((n) => `${target} -> ${n}`).join("\n") : "No PTR record found.";
  }

  const records = (await resolver.resolve(target, recordType)) as unknown[];
  if (records.length === 0) return "No records found.";
  return records.map((r) => formatRecord(r)).join("\n");
}

// --- NTP Server Test ---
// w32tm is the built-in Windows NTP client; /stripchart /dataonly gives a single clean
// offset reading without needing to speak raw NTP UDP ourselves.
export async function ntpTest(target: string): Promise<string> {
  return execRaw("w32tm", ["/stripchart", `/computer:${target}`, "/samples:1", "/dataonly"], 15000);
}

// --- Reverse DNS Tool ---
// Dedicated, IP-only reverse lookup (unlike Host, which auto-detects direction).
export async function reverseDns(target: string): Promise<string> {
  if (!isIpTarget(target)) {
    throw new Error("Reverse DNS requires an IP address, not a hostname.");
  }
  const names = await dnsPromises.reverse(target);
  return names.length > 0 ? names.map((n) => `${target} -> ${n}`).join("\n") : "No PTR record found.";
}

// --- DNS Propagation Checker ---
// Queries the same record from a fixed set of well-known public resolvers, so you can see
// whether a DNS change has propagated globally yet or is still cached/stale on some of them.
const PUBLIC_DNS_SERVERS: { label: string; ip: string }[] = [
  { label: "Google", ip: "8.8.8.8" },
  { label: "Cloudflare", ip: "1.1.1.1" },
  { label: "Quad9", ip: "9.9.9.9" },
  { label: "OpenDNS", ip: "208.67.222.222" },
  { label: "Verisign", ip: "64.6.64.6" },
  { label: "Level3/CenturyLink", ip: "4.2.2.2" },
];

export async function dnsPropagationCheck(domain: string, recordType: string): Promise<string> {
  const results = await Promise.all(
    PUBLIC_DNS_SERVERS.map(async ({ label, ip }) => {
      try {
        const resolver = new dns.promises.Resolver();
        resolver.setServers([ip]);
        const records = (await resolver.resolve(domain, recordType)) as unknown[];
        const value = records.length > 0 ? records.map((r) => formatRecord(r)).join(", ") : "(none)";
        return `${label.padEnd(20)} (${ip.padEnd(15)}): ${value}`;
      } catch (err) {
        return `${label.padEnd(20)} (${ip.padEnd(15)}): lookup failed (${(err as Error).message})`;
      }
    })
  );
  return [`${recordType} records for ${domain} across public resolvers:`, "", ...results].join("\n");
}

// --- MTR Tool (simplified) ---
// Real mtr continuously re-probes every hop; this does one traceroute pass to discover hops
// (raw IPs, no hostname resolution, for speed) then pings each discovered hop a handful of
// times in parallel to get per-hop loss/latency — a single-pass snapshot, not a live stream.
function parseTracertHopIps(output: string): (string | null)[] {
  const hops: (string | null)[] = [];
  // Windows tracert output is CRLF — split on \r?\n so no line keeps a trailing \r, which
  // would otherwise stop a `.*$` pattern short (`.` excludes \r as a line terminator).
  for (const line of output.split(/\r?\n/)) {
    const hopMatch = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!hopMatch) continue;
    const ipMatch = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/.exec(hopMatch[2]);
    hops.push(ipMatch ? ipMatch[1] : null);
  }
  return hops;
}

export function parsePingSummary(output: string): { sent: number; recv: number; lossPct: number; min: string; avg: string; max: string } {
  const statsMatch = /Sent = (\d+), Received = (\d+), Lost = \d+ \((\d+)% loss\)/.exec(output);
  const rttMatch = /Minimum = (\d+)ms, Maximum = (\d+)ms, Average = (\d+)ms/.exec(output);
  return {
    sent: statsMatch ? Number(statsMatch[1]) : 4,
    recv: statsMatch ? Number(statsMatch[2]) : 0,
    lossPct: statsMatch ? Number(statsMatch[3]) : 100,
    min: rttMatch ? `${rttMatch[1]}ms` : "-",
    avg: rttMatch ? `${rttMatch[3]}ms` : "-",
    max: rttMatch ? `${rttMatch[2]}ms` : "-",
  };
}

// --- Redirect Checker ---
// Follows a URL's full redirect chain hop by hop (not just the final destination), reusing
// the same SSRF guard the Website & API Monitoring engine uses (checkLiteralIpNotRestricted +
// createSafeLookup, re-validated on every hop) since this accepts an arbitrary admin-supplied
// URL the same way that monitoring engine does. Only reads response headers (res.resume()
// discards the body) - a redirect chain never needs page content, just status + Location.
const MAX_REDIRECT_HOPS = 15;
const REDIRECT_HOP_TIMEOUT_MS = 10000;

interface RedirectHopResult {
  statusCode: number;
  location: string | null;
}

function fetchHeadersOnce(targetUrl: string): Promise<RedirectHopResult> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try {
      u = new URL(targetUrl);
    } catch {
      reject(new Error(`"${targetUrl}" is not a valid URL.`));
      return;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      reject(new Error(`Unsupported protocol "${u.protocol}" - only http and https are allowed.`));
      return;
    }
    try {
      checkLiteralIpNotRestricted(u.hostname);
    } catch (err) {
      reject(err);
      return;
    }

    const isHttps = u.protocol === "https:";
    const req = (isHttps ? https : http).request(
      targetUrl,
      {
        method: "GET",
        headers: { "User-Agent": "LogMonitor-RedirectChecker/1.0", Accept: "text/html,application/xhtml+xml,*/*" },
        timeout: REDIRECT_HOP_TIMEOUT_MS,
        lookup: createSafeLookup(),
        autoSelectFamily: false,
      },
      (res) => {
        res.resume(); // discard the body - only status/headers matter for a redirect chain
        resolve({
          statusCode: res.statusCode ?? 0,
          location: typeof res.headers.location === "string" ? res.headers.location : null,
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out.")));
    req.on("error", reject);
    req.end();
  });
}

export async function checkRedirectChain(rawUrl: string): Promise<string> {
  const startUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const hops: { url: string; statusCode: number | null; nextUrl: string | null; error: string | null }[] = [];
  const seen = new Set<string>();
  let currentUrl = startUrl;
  let stoppedAtCap = false;

  for (let i = 0; i < MAX_REDIRECT_HOPS; i++) {
    if (seen.has(currentUrl)) {
      hops.push({ url: currentUrl, statusCode: null, nextUrl: null, error: "Redirect loop detected - this exact URL was already visited earlier in the chain." });
      break;
    }
    seen.add(currentUrl);

    try {
      const { statusCode, location } = await fetchHeadersOnce(currentUrl);
      const isRedirect = statusCode >= 300 && statusCode < 400 && location;
      if (!isRedirect) {
        hops.push({ url: currentUrl, statusCode, nextUrl: null, error: null });
        break;
      }
      const nextUrl = new URL(location, currentUrl).toString();
      hops.push({ url: currentUrl, statusCode, nextUrl, error: null });
      currentUrl = nextUrl;
      if (i === MAX_REDIRECT_HOPS - 1) stoppedAtCap = true;
    } catch (err) {
      const message = err instanceof SsrfBlockedError ? err.message : err instanceof Error ? err.message : "Request failed.";
      hops.push({ url: currentUrl, statusCode: null, nextUrl: null, error: message });
      break;
    }
  }

  const lines: string[] = [`Redirect chain for ${startUrl}:`, ""];
  hops.forEach((hop, i) => {
    lines.push(`${i + 1}. ${hop.url}`);
    if (hop.error) {
      lines.push(`   -> ${hop.error}`);
    } else if (hop.nextUrl) {
      lines.push(`   -> HTTP ${hop.statusCode} -> ${hop.nextUrl}`);
    } else {
      lines.push(`   -> HTTP ${hop.statusCode} (final destination, no further redirect)`);
    }
    lines.push("");
  });

  const redirectCount = hops.filter((h) => h.nextUrl).length;
  const last = hops[hops.length - 1];
  lines.push(`Total redirects: ${redirectCount}`);
  if (last && !last.error && !last.nextUrl) {
    lines.push(`Final URL: ${last.url} (HTTP ${last.statusCode})`);
  } else if (stoppedAtCap) {
    lines.push(`Stopped after ${MAX_REDIRECT_HOPS} hops without reaching a final page - likely a redirect loop or an unusually long chain.`);
  }

  return lines.join("\n");
}

export async function runMtr(target: string): Promise<string> {
  const traceOutput = await execRaw("tracert", ["-d", "-h", "20", "-w", "500", target], 25000);
  const hopIps = parseTracertHopIps(traceOutput);
  if (hopIps.length === 0) return `Could not trace a route to ${target}.\n\n${traceOutput}`;

  const rows = await Promise.all(
    hopIps.map(async (ip, i) => {
      const hop = i + 1;
      if (!ip) return `${String(hop).padEnd(4)} ${"*".padEnd(16)} ${"100%".padEnd(5)} 4     0     -      -      -`;
      const pingOutput = await execRaw("ping", ["-n", "4", "-w", "500", ip], 10000);
      const s = parsePingSummary(pingOutput);
      return `${String(hop).padEnd(4)} ${ip.padEnd(16)} ${`${s.lossPct}%`.padEnd(5)} ${String(s.sent).padEnd(5)} ${String(s.recv).padEnd(5)} ${s.avg.padEnd(6)} ${s.min.padEnd(6)} ${s.max}`;
    })
  );

  const header = "Hop  Host             Loss  Sent  Recv  Avg    Best   Worst";
  return [header, ...rows].join("\n");
}
