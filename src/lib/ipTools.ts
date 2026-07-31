import dns from "dns";
import net from "net";

const dnsPromises = dns.promises;

const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

export function isValidIp(input: string): boolean {
  if (IPV4_RE.test(input)) return input.split(".").every((o) => Number(o) <= 255);
  return input.includes(":") && IPV6_RE.test(input);
}

export function isValidIpOrDomain(input: string): boolean {
  if (!input || input.length > 253) return false;
  if (isValidIp(input)) return true;
  return HOSTNAME_RE.test(input);
}

interface IpApiResponse {
  status: string;
  message?: string;
  continent?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  asname?: string;
  reverse?: string;
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
  query?: string;
}

const IPAPI_FIELDS =
  "status,message,continent,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query";

// ip-api.com's free tier includes geolocation plus mobile/proxy/hosting flags when the
// extended `fields` query string is used — good enough for a "likely VPN/proxy/datacenter"
// signal without needing a paid provider. It's a heuristic (ASN/network-type based), not a
// guarantee, since it can't see actual VPN tunnel traffic.
async function ipApiLookup(target: string): Promise<IpApiResponse> {
  const url = `http://ip-api.com/json/${encodeURIComponent(target)}?fields=${IPAPI_FIELDS}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as IpApiResponse;
  if (data.status !== "success") throw new Error(data.message || "Lookup failed.");
  return data;
}

function formatIpApiResult(data: IpApiResponse, heading: string): string {
  const lines = [heading, ""];
  lines.push(`IP Address: ${data.query}`);
  if (data.reverse) lines.push(`Hostname: ${data.reverse}`);
  lines.push(`ISP: ${data.isp ?? "-"}`);
  lines.push(`Organization: ${data.org ?? "-"}`);
  lines.push(`ASN: ${data.as ?? "-"}`);
  lines.push(`Location: ${[data.city, data.regionName, data.country].filter(Boolean).join(", ") || "-"}`);
  lines.push(`Timezone: ${data.timezone ?? "-"}`);
  lines.push(`Coordinates: ${data.lat ?? "-"}, ${data.lon ?? "-"}`);
  return lines.join("\n");
}

export interface MyIpSummary {
  ip: string;
  isp: string | null;
  city: string | null;
  country: string | null;
}

// This server's own public IP/ISP/location changes rarely (if ever) between page loads —
// cached in-memory so the dashboard (which re-runs this on every request, force-dynamic)
// doesn't re-hit ipify + ip-api on every single page view. Same pattern as
// trafficByCountry.ts's cache. The on-demand "What Is My IP" tool page below intentionally
// does NOT use this cache — a user explicitly running that tool expects a live lookup.
const MY_IP_CACHE_TTL_MS = 5 * 60 * 1000;
let myIpCache: { result: MyIpSummary; fetchedAt: number } | null = null;

// Structured variant of the same lookup below, for widgets that need individual fields
// (e.g. the dashboard's right-rail card) rather than the pre-formatted text block the
// What Is My IP tool page displays.
export async function getMyIpSummary(): Promise<MyIpSummary> {
  if (myIpCache && Date.now() - myIpCache.fetchedAt < MY_IP_CACHE_TTL_MS) return myIpCache.result;
  const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
  if (!ipRes.ok) throw new Error(`Could not determine public IP (HTTP ${ipRes.status}).`);
  const { ip } = (await ipRes.json()) as { ip: string };
  const data = await ipApiLookup(ip);
  const result = { ip, isp: data.isp ?? null, city: data.city ?? null, country: data.country ?? null };
  myIpCache = { result, fetchedAt: Date.now() };
  return result;
}

// --- What Is My IP ---
// Runs from this server, so it reports this server's own public IP — same caveat as every
// other tool in this app (ping/traceroute/etc. all reflect what the server sees, not a browser).
export async function myIpInfo(): Promise<string> {
  const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
  if (!ipRes.ok) throw new Error(`Could not determine public IP (HTTP ${ipRes.status}).`);
  const { ip } = (await ipRes.json()) as { ip: string };

  const data = await ipApiLookup(ip);
  return formatIpApiResult(data, "This server's public IP address:");
}

// --- IP Lookup ---
export async function ipLookup(target: string): Promise<string> {
  const data = await ipApiLookup(target);
  return formatIpApiResult(data, `IP Lookup for ${target}:`);
}

// --- Proxy / VPN Detection ---
export async function proxyVpnDetection(target: string): Promise<string> {
  const data = await ipApiLookup(target);
  const lines = [`Proxy/VPN/Hosting detection for ${target}:`, ""];
  lines.push(`ISP: ${data.isp ?? "-"}`);
  lines.push(`Organization: ${data.org ?? "-"}`);
  lines.push(`ASN: ${data.as ?? "-"}`);
  lines.push("");
  lines.push(`Mobile Connection: ${data.mobile ? "yes" : "no"}`);
  lines.push(`Known Proxy/VPN: ${data.proxy ? "yes" : "no"}`);
  lines.push(`Hosting/Datacenter IP: ${data.hosting ? "yes" : "no"}`);
  lines.push("");
  if (data.proxy || data.hosting) {
    lines.push("⚠ This IP is associated with a proxy, VPN, or hosting/datacenter provider — not a typical residential connection.");
  } else {
    lines.push("✓ No proxy/VPN/hosting signals detected — appears to be a regular residential or business IP.");
  }
  lines.push("");
  lines.push("Note: this is a heuristic based on known IP ranges/ASN data, not a guarantee — it can't see inside an encrypted VPN tunnel, only where the connection is exiting from.");
  return lines.join("\n");
}

// --- WHOIS Lookup (raw WHOIS protocol, RFC 3912) ---
// A real port-43 WHOIS client rather than an RDAP/JSON summary: RDAP has no coverage for many
// ccTLDs (e.g. .se has no RDAP endpoint at all — confirmed against rdap.org, which 404s for it),
// while every TLD's registry still answers the original text protocol. This returns the
// registry's own raw text verbatim (same output a `whois` CLI would print), which is what
// carries registrar/organization details (e.g. .se's `registrar:` line) - never attempts to
// deanonymize a registry-redacted holder/registrant field (e.g. .se's opaque `holder:` handle,
// withheld under Swedish privacy law per that server's own banner) - only what the registry
// itself discloses is ever shown.
const WHOIS_QUERY_TIMEOUT_MS = 10000;
const WHOIS_PORT = 43;

function rawWhoisQuery(server: string, query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: server, port: WHOIS_PORT });
    let data = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`WHOIS query to ${server} timed out.`));
    }, WHOIS_QUERY_TIMEOUT_MS);
    socket.on("connect", () => socket.write(`${query}\r\n`));
    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
    });
    socket.on("end", () => {
      clearTimeout(timer);
      resolve(data);
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// Many registries answer with only a thin record plus a pointer to the registrar's own (fuller)
// WHOIS server - this is the standard one-hop referral every public whois client follows.
export function extractReferralServer(text: string): string | null {
  const match = text.match(/^\s*(?:Registrar WHOIS Server|Whois Server|ReferralServer)\s*:\s*(?:whois:\/\/)?(\S+?)\/?\s*$/im);
  return match ? match[1] : null;
}

// IANA's own WHOIS server is the canonical bootstrap for "which server is authoritative for
// this TLD" - avoids maintaining a hand-curated per-TLD server list that would silently rot.
async function findTldWhoisServer(domain: string): Promise<string> {
  const tld = domain.split(".").pop();
  if (!tld) throw new Error(`Could not determine the TLD for ${domain}.`);
  const referral = await rawWhoisQuery("whois.iana.org", tld);
  const match = referral.match(/^\s*whois:\s*(\S+)/im);
  if (!match) throw new Error(`No public WHOIS server is registered for .${tld} with IANA.`);
  return match[1];
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, unknown[]];
  entities?: RdapEntity[];
}

interface RdapIpResponse {
  handle?: string;
  startAddress?: string;
  endAddress?: string;
  name?: string;
  type?: string;
  country?: string;
  entities?: RdapEntity[];
}

function pickVcardField(vcardArray: unknown, field: string): string | null {
  if (!Array.isArray(vcardArray) || !Array.isArray(vcardArray[1])) return null;
  const entry = (vcardArray[1] as unknown[][]).find((e) => Array.isArray(e) && e[0] === field);
  return entry && typeof entry[3] === "string" ? entry[3] : null;
}

// Formats an RDAP IP-network response into the same plain key/value shape the raw-WHOIS
// output above uses, so both paths read consistently in the UI.
function formatRdapIp(data: RdapIpResponse, target: string): string {
  const lines = [`RDAP lookup for ${target}:`, ""];
  if (data.handle) lines.push(`handle:      ${data.handle}`);
  if (data.name) lines.push(`network:     ${data.name}`);
  if (data.startAddress && data.endAddress) lines.push(`range:       ${data.startAddress} - ${data.endAddress}`);
  if (data.type) lines.push(`type:        ${data.type}`);
  if (data.country) lines.push(`country:     ${data.country}`);

  for (const entity of data.entities ?? []) {
    const org = entity.vcardArray ? pickVcardField(entity.vcardArray, "fn") : null;
    if (org && entity.roles?.length) lines.push(`${entity.roles.join("/")}:  ${org}`);
  }

  return lines.join("\n");
}

// ARIN's port-43 WHOIS service blocks/drops queries from many datacenter and cloud egress
// ranges (confirmed: ARIN unreachable on port 43 from this network while reachable on 443,
// and other RIRs' port 43 works fine from the same network) - RDAP is the documented modern
// replacement and has full IP/RIR coverage via the same bootstrap registries, over plain
// HTTPS, so it's used as a fallback for the IP case specifically rather than leaving IP
// lookups broken on networks where ARIN's legacy WHOIS port is filtered.
async function rdapIpFallback(target: string): Promise<string> {
  const res = await fetch(`https://rdap.org/ip/${encodeURIComponent(target)}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`RDAP lookup failed (HTTP ${res.status}).`);
  const data = (await res.json()) as RdapIpResponse;
  return formatRdapIp(data, target);
}

export async function whoisLookup(target: string): Promise<string> {
  const isIp = isValidIp(target);
  const server = isIp ? "whois.arin.org" : await findTldWhoisServer(target);

  let primary: string;
  try {
    primary = await rawWhoisQuery(server, target);
  } catch (err) {
    if (isIp) return rdapIpFallback(target);
    throw err;
  }

  const referralServer = extractReferralServer(primary);

  if (!referralServer || referralServer.toLowerCase() === server.toLowerCase()) {
    return primary.trim();
  }

  try {
    const secondary = await rawWhoisQuery(referralServer, target);
    return `${primary.trim()}\n\n${secondary.trim()}`;
  } catch {
    // Some registrar/RIR WHOIS servers rate-limit or block automated queries - the registry-
    // level response above is still a complete, valid answer on its own, so a failed referral
    // hop isn't fatal to the whole lookup.
    return primary.trim();
  }
}

// --- Blacklist Check (DNSBL) ---
// Same technique used by the Test Email Delivery tools — a DNSBL lists offending IPs by
// encoding the reversed octets as a subdomain of the list's zone; an A record back means listed.
const DNSBL_ZONES = [
  { name: "Spamhaus ZEN", zone: "zen.spamhaus.org" },
  { name: "SpamCop", zone: "bl.spamcop.net" },
  { name: "Barracuda", zone: "b.barracudacentral.org" },
  { name: "SORBS", zone: "dnsbl.sorbs.net" },
  { name: "PSBL", zone: "psbl.surriel.com" },
];

export async function blacklistCheck(ip: string): Promise<string> {
  const reversed = ip.split(".").reverse().join(".");
  const lines = [`Blacklist check for ${ip}:`, ""];
  let anyListed = false;

  for (const { name, zone } of DNSBL_ZONES) {
    const query = `${reversed}.${zone}`;
    try {
      await dnsPromises.resolve4(query);
      anyListed = true;
      lines.push(`[LISTED] ${name}`);
    } catch {
      lines.push(`[clean]  ${name}`);
    }
  }

  lines.push("");
  lines.push(
    anyListed
      ? "⚠ This IP is listed on at least one blacklist — likely to affect email deliverability and may be blocked by some services."
      : "✓ Not listed on any of the checked blacklists."
  );
  return lines.join("\n");
}

// --- IPv6 Test ---
// Checks whether this server has working IPv6 connectivity by hitting an IPv6-only endpoint,
// and compares against the IPv4 result to show whether the two protocols actually differ.
export async function ipv6Test(): Promise<string> {
  const lines = ["IPv6 connectivity test for this server:", ""];

  let ipv4: string | null = null;
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { ip: string };
    ipv4 = data.ip;
    lines.push(`IPv4 Address: ${ipv4}`);
  } catch (err) {
    lines.push(`IPv4 Address: lookup failed (${err instanceof Error ? err.message : String(err)})`);
  }

  try {
    const res = await fetch("https://api64.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { ip: string };
    const isV6 = data.ip.includes(":");
    lines.push(`IPv6-capable lookup returned: ${data.ip}`);
    lines.push("");
    if (isV6) {
      lines.push("✓ This server has working IPv6 connectivity — outbound requests can use IPv6.");
    } else {
      lines.push("✗ This server does NOT have working IPv6 connectivity — the IPv6-capable endpoint fell back to IPv4.");
    }
  } catch (err) {
    lines.push("");
    lines.push(`✗ This server does NOT have working IPv6 connectivity (${err instanceof Error ? err.message : String(err)}).`);
  }

  return lines.join("\n");
}
