import dns from "dns";

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

// Structured variant of the same lookup below, for widgets that need individual fields
// (e.g. the dashboard's right-rail card) rather than the pre-formatted text block the
// What Is My IP tool page displays.
export async function getMyIpSummary(): Promise<MyIpSummary> {
  const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
  if (!ipRes.ok) throw new Error(`Could not determine public IP (HTTP ${ipRes.status}).`);
  const { ip } = (await ipRes.json()) as { ip: string };
  const data = await ipApiLookup(ip);
  return { ip, isp: data.isp ?? null, city: data.city ?? null, country: data.country ?? null };
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

// --- WHOIS Lookup (via RDAP) ---
// RDAP is the modern, structured, IANA-standardized replacement for legacy WHOIS text
// parsing — rdap.org acts as a bootstrap redirector to the authoritative registry for any
// domain or IP, so one endpoint works for both without us needing per-TLD/per-RIR server lists.
function pickVcardField(vcardArray: unknown, field: string): string | null {
  if (!Array.isArray(vcardArray) || vcardArray.length < 2 || !Array.isArray(vcardArray[1])) return null;
  const entry = (vcardArray[1] as unknown[]).find((e) => Array.isArray(e) && e[0] === field) as unknown[] | undefined;
  return entry && typeof entry[3] !== "undefined" ? String(entry[3]) : null;
}

export async function whoisLookup(target: string): Promise<string> {
  const kind = isValidIp(target) ? "ip" : "domain";
  const url = `https://rdap.org/${kind}/${encodeURIComponent(target)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    if (res.status === 404) return `No WHOIS/RDAP record found for ${target}.`;
    throw new Error(`RDAP lookup failed (HTTP ${res.status}).`);
  }
  const data = await res.json();

  const lines = [`WHOIS (RDAP) record for ${target}:`, ""];
  if (data.ldhName) lines.push(`Domain: ${data.ldhName}`);
  if (data.handle) lines.push(`Handle: ${data.handle}`);
  if (Array.isArray(data.status) && data.status.length) lines.push(`Status: ${data.status.join(", ")}`);
  if (Array.isArray(data.nameservers) && data.nameservers.length) {
    lines.push(`Nameservers: ${data.nameservers.map((n: { ldhName?: string }) => n.ldhName).filter(Boolean).join(", ")}`);
  }
  if (kind === "ip") {
    if (data.startAddress) lines.push(`Range: ${data.startAddress} - ${data.endAddress ?? ""}`);
    if (data.name) lines.push(`Network Name: ${data.name}`);
    if (data.country) lines.push(`Country: ${data.country}`);
  }

  if (Array.isArray(data.events)) {
    for (const ev of data.events as { eventAction: string; eventDate: string }[]) {
      lines.push(`${ev.eventAction}: ${new Date(ev.eventDate).toISOString().slice(0, 10)}`);
    }
  }

  if (Array.isArray(data.entities)) {
    for (const entity of data.entities as { roles?: string[]; vcardArray?: unknown }[]) {
      const role = entity.roles?.join("/") ?? "entity";
      const name = entity.vcardArray ? pickVcardField(entity.vcardArray, "fn") : null;
      const org = entity.vcardArray ? pickVcardField(entity.vcardArray, "org") : null;
      const label = name || org;
      if (label) lines.push(`${role}: ${label}`);
    }
  }

  return lines.join("\n");
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
