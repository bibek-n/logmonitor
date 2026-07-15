import http from "http";
import https from "https";
import dns from "dns";
import net from "net";

// Real DNS/TCP/TLS/TTFB phase timing via Node's low-level http(s) socket events - the
// existing websiteSecurityAudit/performanceChecks.ts only measures TTFB and total response
// time via fetch() (headers-arrived vs body-read), it doesn't break the connection phase
// itself into DNS/TCP/TLS. That coarser signal is still reused as-is by the test runner for
// compression/HTTP2/HTTP3 detection rather than duplicated here - this file only adds the
// genuinely new per-phase breakdown plus redirect-chain/response-size/server-IP collection.

const UA = "LogMonitor-WebsitePerformance/1.0 (+authorized-scan)";
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024; // 25MB cap, same order of magnitude as a real page load

// Same private/loopback/link-local/multicast ranges already used by
// src/lib/trafficByCountry.ts's isPublicIp, plus the common cloud metadata address - no
// existing exported SSRF guard was found elsewhere in the codebase to import, so this
// re-establishes that same range logic locally rather than inventing a different one.
const RESTRICTED_IP_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^22[4-9]\./,
  /^23\d\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
];

function isRestrictedIp(ip: string): boolean {
  return RESTRICTED_IP_PATTERNS.some((re) => re.test(ip));
}

export class ConnectionTimingError extends Error {}

export interface ConnectionTimingResult {
  finalUrl: string;
  httpStatusCode: number;
  redirectCount: number;
  responseSizeBytes: number;
  httpProtocol: string;
  serverIp: string | null;
  dnsLookupMs: number;
  tcpConnectMs: number;
  tlsHandshakeMs: number;
  ttfbMs: number;
  contentDownloadMs: number;
  totalResponseTimeMs: number;
}

function fetchOnce(targetUrl: string, timeoutMs: number): Promise<{
  statusCode: number;
  location: string | null;
  bytes: number;
  serverIp: string | null;
  dnsMs: number;
  tcpMs: number;
  tlsMs: number;
  ttfbMs: number;
  downloadMs: number;
  protocol: string;
}> {
  return new Promise((resolvePromise, reject) => {
    const u = new URL(targetUrl);
    const isHttps = u.protocol === "https:";
    const lib = isHttps ? https : http;

    // The custom `lookup` option below only fires when Node actually has to resolve a
    // hostname via DNS - when the URL's host is already a literal IP address (or a redirect
    // hop lands on one), net.isIP() is truthy and Node connects directly, skipping `lookup`
    // entirely. Verified live: this let http://192.168.1.15/ (and 127.0.0.1) sail straight
    // past the DNS-based guard below. This upfront check closes that gap for literal-IP URLs;
    // the `lookup` override still covers hostname URLs (including DNS-rebinding attempts).
    if (net.isIP(u.hostname) && isRestrictedIp(u.hostname)) {
      reject(new Error(`Target resolves to a restricted/private IP address (${u.hostname}) - blocked.`));
      return;
    }

    const t0 = Date.now();
    let dnsAt = 0;
    let tcpAt = 0;
    let tlsAt = 0;
    let resolvedIp: string | null = null;

    const req = lib.request(
      targetUrl,
      {
        method: "GET",
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
        timeout: timeoutMs,
        // Node's lookup callback contract is error-first: passing a truthy error alongside a
        // real address/family (as an earlier version of this code did) put http's internal
        // ClientRequest into an inconsistent state - it started tearing down a socket that
        // was simultaneously treated as having a valid address, which crashed the whole
        // process with a native "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" in
        // libuv rather than just failing this one request. Only the error may be passed when
        // blocking a restricted target - never the address next to it.
        lookup: (hostname, opts, callback) => {
          dns.lookup(hostname, opts, (err, address, family) => {
            if (err) {
              callback(err, "", 0);
              return;
            }
            if (typeof address === "string" && isRestrictedIp(address)) {
              callback(new Error("Resolved to a restricted/private IP address - blocked."), "", 0);
              return;
            }
            callback(null, address, family);
          });
        },
      },
      (res) => {
        const ttfbMs = Date.now() - t0;
        let bytes = 0;
        const chunks: number[] = [];
        res.on("data", (chunk: Buffer) => {
          if (req.destroyed) return;
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            res.destroy();
            req.destroy(new Error("Response exceeded size limit."));
            return;
          }
          chunks.push(chunk.length);
        });
        res.on("end", () => {
          const downloadMs = Date.now() - t0 - ttfbMs;
          resolvePromise({
            statusCode: res.statusCode ?? 0,
            location: typeof res.headers.location === "string" ? res.headers.location : null,
            bytes,
            serverIp: resolvedIp,
            dnsMs: dnsAt,
            tcpMs: tcpAt,
            tlsMs: tlsAt,
            ttfbMs,
            downloadMs,
            protocol: (res.httpVersion ?? "1.1").startsWith("2") ? "HTTP/2" : `HTTP/${res.httpVersion ?? "1.1"}`,
          });
        });
        res.on("error", reject);
      }
    );

    req.on("socket", (socket) => {
      socket.on("lookup", () => {
        dnsAt = Date.now() - t0;
      });
      socket.on("connect", () => {
        tcpAt = Date.now() - t0 - dnsAt;
        // socket.address() is the LOCAL end of the connection (this server's own outbound
        // IP) - remoteAddress is the actual peer being connected to. Verified live: this bug
        // made every scan report this server's own LAN IP as the target's "Server IP".
        resolvedIp = socket.remoteAddress ?? null;
      });
      socket.on("secureConnect", () => {
        tlsAt = Date.now() - t0 - dnsAt - tcpAt;
      });
    });

    req.on("timeout", () => req.destroy(new Error("Request timed out.")));
    req.on("error", (err) => reject(err));
    req.end();
  });
}

// Follows redirects manually (rather than letting fetch()/http follow them transparently) so
// each hop can be revalidated against the SSRF guard before connecting - a redirect to an
// internal address must be blocked just as surely as the initial URL.
export async function measureConnectionTiming(startUrl: string, timeoutSeconds: number): Promise<ConnectionTimingResult> {
  let currentUrl = startUrl;
  let redirectCount = 0;
  let firstDnsMs = 0;
  let firstTcpMs = 0;
  let firstTlsMs = 0;
  let firstTtfbMs = 0;
  const overallStart = Date.now();
  const perHopTimeoutMs = Math.max(5000, timeoutSeconds * 1000);

  for (;;) {
    let hop;
    try {
      hop = await fetchOnce(currentUrl, perHopTimeoutMs);
    } catch (err) {
      throw new ConnectionTimingError(err instanceof Error ? err.message : "Connection failed.");
    }

    if (redirectCount === 0) {
      firstDnsMs = hop.dnsMs;
      firstTcpMs = hop.tcpMs;
      firstTlsMs = hop.tlsMs;
      firstTtfbMs = hop.ttfbMs;
    }

    const isRedirect = hop.statusCode >= 300 && hop.statusCode < 400 && hop.location;
    if (isRedirect && redirectCount < MAX_REDIRECTS) {
      redirectCount += 1;
      currentUrl = new URL(hop.location as string, currentUrl).toString();
      continue;
    }

    return {
      finalUrl: currentUrl,
      httpStatusCode: hop.statusCode,
      redirectCount,
      responseSizeBytes: hop.bytes,
      httpProtocol: hop.protocol,
      serverIp: hop.serverIp,
      dnsLookupMs: firstDnsMs,
      tcpConnectMs: firstTcpMs,
      tlsHandshakeMs: firstTlsMs,
      ttfbMs: firstTtfbMs,
      contentDownloadMs: hop.downloadMs,
      totalResponseTimeMs: Date.now() - overallStart,
    };
  }
}
