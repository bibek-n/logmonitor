import type { LookupOptions } from "dns";
import https from "https";
import net from "net";

// This host's network path has been observed silently rewriting plain (port 53) DNS answers
// for certain specific domains to a bogus loopback address (127.x.x.x), even when explicitly
// querying public resolvers like 1.1.1.1/8.8.8.8 directly - confirmed by querying the exact
// same domains via DNS-over-HTTPS (which rides on ordinary HTTPS/443, not distinguishable from
// any other secure web traffic) and getting back the real, correct, publicly-reachable IP
// every time. So resolution here deliberately avoids Node's dns module entirely (dns.lookup()
// always uses the OS resolver via libuv's getaddrinfo; dns.resolve4/6() use the c-ares
// resolver over plain port 53 - both hit the same interception) in favor of querying a DoH
// endpoint directly over HTTPS. Falls back from Cloudflare to Google if the first provider
// errors, so a single provider outage doesn't take monitoring down with it.
const DOH_PROVIDERS: { host: string; path: string; headers: Record<string, string> }[] = [
  { host: "cloudflare-dns.com", path: "/dns-query", headers: { Accept: "application/dns-json" } },
  { host: "dns.google", path: "/resolve", headers: {} },
];
const DOH_RR_TYPE = { A: 1, AAAA: 28 } as const;
const DOH_TIMEOUT_MS = 5000;

interface DohAnswer {
  type: number;
  data: string;
}
interface DohResponse {
  Answer?: DohAnswer[];
}

function dohQuery(providerHost: string, basePath: string, headers: Record<string, string>, hostname: string, type: keyof typeof DOH_RR_TYPE): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const path = `${basePath}?name=${encodeURIComponent(hostname)}&type=${type}`;
    const req = https.get({ host: providerHost, path, headers, timeout: DOH_TIMEOUT_MS }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed: DohResponse = JSON.parse(body);
          const answers = (parsed.Answer ?? []).filter((a) => a.type === DOH_RR_TYPE[type]).map((a) => a.data);
          resolve(answers);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`DoH query to ${providerHost} timed out`)));
    req.on("error", reject);
  });
}

// This app has independently reimplemented private-IP blocking three times already
// (src/lib/trafficByCountry.ts's isPublicIp, src/lib/websitePerformance/connectionTiming.ts's
// RESTRICTED_IP_PATTERNS, src/lib/mailSecurity/urlInspection.ts's isPrivateOrReservedIp) - this
// is deliberately a fourth, matching connectionTiming.ts's approach specifically (hooking
// Node's own `lookup` option on http(s).request, which validates the IP the socket actually
// connects to, not just an IP a separate earlier dns.lookup() call happened to return - the
// gap that makes DNS-rebinding attacks possible against a "check once, connect separately"
// guard). Not extracted into a shared cross-module utility since connectionTiming.ts's is
// itself only used by one call site - three copies of a bounded ~15-line regex list is a
// smaller cost than the coupling of forcing an unrelated module to import Mail Security's or
// Website Performance's internal files.
const RESTRICTED_IP_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./, // includes 169.254.169.254 cloud metadata
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^22[4-9]\./, // multicast
  /^23\d\./,
  /^::1$/,
  /^fe80:/i, // link-local
  /^fc00:/i, // unique local
  /^fd00:/i,
];

export function isRestrictedIp(ip: string): boolean {
  return RESTRICTED_IP_PATTERNS.some((re) => re.test(ip));
}

export class SsrfBlockedError extends Error {}

// Rejects up front if the URL's host is already a literal restricted IP (net.isIP() is
// truthy, so Node connects directly and never calls the `lookup` option below at all -
// verified in Website Performance's own module that this is a real, exploitable gap for
// literal-IP URLs otherwise).
export function checkLiteralIpNotRestricted(hostname: string): void {
  if (net.isIP(hostname) && isRestrictedIp(hostname)) {
    throw new SsrfBlockedError(`Target resolves to a restricted/private IP address (${hostname}) - blocked.`);
  }
}

// Tries each DoH provider in turn, A records first then falling back to AAAA - matching
// dns.lookup()'s typical IPv4-preferred behavior closely enough for a monitoring check
// (nothing here depends on exact Happy-Eyeballs semantics, since the caller disables
// autoSelectFamily and only ever wants one address).
async function resolveHostname(hostname: string): Promise<{ address: string; family: number }> {
  // A URL can itself use a literal IP (e.g. http://8.8.8.8/) - that has to be handled before
  // ever making a DoH query, since there's nothing to look up for an address that's already
  // an address.
  const literalFamily = net.isIP(hostname);
  if (literalFamily) return { address: hostname, family: literalFamily };

  let lastError: unknown = new Error(`No addresses found for ${hostname}`);
  for (const provider of DOH_PROVIDERS) {
    try {
      const aAnswers = await dohQuery(provider.host, provider.path, provider.headers, hostname, "A");
      if (aAnswers.length > 0) return { address: aAnswers[0], family: 4 };
      const aaaaAnswers = await dohQuery(provider.host, provider.path, provider.headers, hostname, "AAAA");
      if (aaaaAnswers.length > 0) return { address: aaaaAnswers[0], family: 6 };
    } catch (err) {
      lastError = err;
      // Try the next DoH provider before giving up entirely.
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// A `lookup` function to pass directly into http.request()/https.request()'s options -
// resolves the hostname exactly as Node normally would, but rejects the connection before it
// opens if the resolved address is private/loopback/link-local/multicast/metadata. Re-invoked
// by the caller on every redirect hop (a fresh request = a fresh lookup call), so a same-check
// DNS-rebinding attempt (public IP when the monitor was created, private IP by the time this
// particular check runs) is still caught at connection time, not just at creation time.
export function createSafeLookup(): (
  hostname: string,
  options: LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
) => void {
  return (hostname, _options, callback) => {
    resolveHostname(hostname)
      .then(({ address, family }) => {
        if (isRestrictedIp(address)) {
          callback(new SsrfBlockedError("Resolved to a restricted/private IP address - blocked."), "", 0);
          return;
        }
        callback(null, address, family);
      })
      .catch((err) => {
        // Error-first contract: never pass a real address alongside a truthy error - doing so
        // once put Node's http internals into an inconsistent state and crashed the process
        // (this exact bug and fix is documented in connectionTiming.ts).
        callback(err instanceof Error ? (err as NodeJS.ErrnoException) : new Error(String(err)), "", 0);
      });
  };
}
