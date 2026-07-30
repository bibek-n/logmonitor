import http from "http";
import https from "https";
import type { PeerCertificate, TLSSocket } from "tls";
import { checkLiteralIpNotRestricted, createSafeLookup, SsrfBlockedError } from "./ssrfGuard";
import { checkContent, checkEmptyBody } from "./contentCheck";
import { detectWafChallenge } from "./wafChallengeDetector";
import { MonitorCheckLimits, SslCertificateInfo, WebsiteCheckResult, WebsiteMonitorConfig } from "./types";

const MAX_BODY_BYTES_FOR_CONTENT_CHECK = 256 * 1024; // enough for keyword/title checks, nowhere near a full page cap
const USER_AGENT_DEFAULT = "LogMonitor-WebsiteMonitor/1.0";

interface HopResult {
  statusCode: number;
  location: string | null;
  bodyExcerpt: string;
  bodyTruncated: boolean;
  totalBytesSeen: number;
  dnsMs: number;
  tcpMs: number;
  tlsMs: number;
  ttfbMs: number;
  ssl: SslCertificateInfo | null;
  headers: Record<string, string | string[] | undefined>;
}

function rdnValue(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function extractSslInfo(socket: TLSSocket, hostname: string): SslCertificateInfo {
  const cert: PeerCertificate | Record<string, never> = socket.getPeerCertificate(false);
  const hasCert = cert && Object.keys(cert).length > 0;
  if (!hasCert) {
    return {
      domain: hostname,
      issuer: null,
      subject: null,
      validFrom: null,
      expiresAt: null,
      hostnameMatch: null,
      chainValid: socket.authorized,
      selfSigned: null,
      tlsProtocol: socket.getProtocol(),
      signatureAlgorithm: null,
    };
  }
  const c = cert as PeerCertificate;
  const subjectCn = rdnValue(c.subject?.CN);
  const issuerCn = rdnValue(c.issuer?.O) ?? rdnValue(c.issuer?.CN);
  const selfSigned = c.issuer?.CN === c.subject?.CN && c.issuer?.O === c.subject?.O;
  const authErrorCode = (socket.authorizationError as unknown as { code?: string } | string | undefined) ?? undefined;
  const authErrorCodeStr = typeof authErrorCode === "string" ? authErrorCode : authErrorCode?.code;
  return {
    domain: hostname,
    issuer: issuerCn,
    subject: subjectCn,
    validFrom: c.valid_from ? new Date(c.valid_from) : null,
    expiresAt: c.valid_to ? new Date(c.valid_to) : null,
    hostnameMatch: socket.authorized || authErrorCodeStr !== "ERR_TLS_CERT_ALTNAME_INVALID",
    chainValid: socket.authorized,
    selfSigned,
    tlsProtocol: socket.getProtocol(),
    signatureAlgorithm: (c as { sigalg?: string }).sigalg ?? null,
  };
}

function fetchOnce(targetUrl: string, method: "GET" | "HEAD", sslVerify: boolean, limits: MonitorCheckLimits): Promise<HopResult> {
  return new Promise((resolvePromise, reject) => {
    const u = new URL(targetUrl);
    const isHttps = u.protocol === "https:";
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      reject(new Error(`Unsupported protocol "${u.protocol}" - only http and https are allowed.`));
      return;
    }
    checkLiteralIpNotRestricted(u.hostname); // throws synchronously if blocked - caught by caller

    const t0 = Date.now();
    let dnsAt = 0;
    let tcpAt = 0;
    let tlsAt = 0;

    // Node 20+ enables Happy Eyeballs (RFC 8305) by default, which calls the `lookup` option
    // requesting `{ all: true }` (an array of every resolved address, to race IPv4/IPv6 in
    // parallel) instead of the single-address form createSafeLookup() implements. Every check
    // was failing with "ERR_INVALID_IP_ADDRESS: Invalid IP address: undefined" because of this
    // exact mismatch - Node's connection-racing logic received a single string back where it
    // expected an address array. Disabling autoSelectFamily reverts to the traditional
    // single-lookup path the guard is built for; dual-stack racing isn't needed for a
    // monitoring check anyway. Cast needed because this project's installed @types/node
    // predates autoSelectFamily's addition to RequestOptions even though Node itself (and the
    // underlying net.SocketConnectOpts type) has supported it since v20.
    const requestOptions: https.RequestOptions & { autoSelectFamily?: boolean } = {
      method,
      headers: { "User-Agent": USER_AGENT_DEFAULT, Accept: "text/html,application/xhtml+xml,*/*" },
      timeout: limits.timeoutMs,
      rejectUnauthorized: isHttps ? sslVerify : undefined,
      lookup: createSafeLookup(),
      autoSelectFamily: false,
    };

    const req = (isHttps ? https : http).request(targetUrl, requestOptions,
      (res) => {
        const ttfbMs = Date.now() - t0;
        let totalBytesSeen = 0;
        const chunks: Buffer[] = [];
        let truncated = false;

        // Captured here, synchronously in the response callback, rather than in the 'end'
        // handler below - confirmed by direct testing that res.socket is a real TLSSocket the
        // instant headers arrive, but is reliably NULL by the time 'end' fires (Node detaches/
        // recycles the socket via keep-alive pooling once the body is fully buffered). Waiting
        // until 'end' meant SSL info was silently never captured for any real HTTPS check -
        // the null-guard added earlier only stopped it from crashing, it didn't fix the actual
        // data loss, which is why SslCertificateRecords stayed empty despite checks succeeding.
        const socket = res.socket as TLSSocket | null;
        const ssl = isHttps && socket && "getPeerCertificate" in socket ? extractSslInfo(socket, u.hostname) : null;

        res.on("data", (chunk: Buffer) => {
          if (req.destroyed) return;
          totalBytesSeen += chunk.length;
          if (totalBytesSeen > limits.maxResponseBytes) {
            res.destroy();
            req.destroy(new Error("Response exceeded the configured size limit."));
            return;
          }
          if (!truncated) {
            const currentSize = chunks.reduce((sum, c) => sum + c.length, 0);
            if (currentSize < MAX_BODY_BYTES_FOR_CONTENT_CHECK) {
              chunks.push(chunk);
            } else {
              truncated = true;
            }
          }
        });
        res.on("end", () => {
          resolvePromise({
            statusCode: res.statusCode ?? 0,
            location: typeof res.headers.location === "string" ? res.headers.location : null,
            bodyExcerpt: Buffer.concat(chunks).toString("utf8"),
            bodyTruncated: truncated,
            totalBytesSeen,
            dnsMs: dnsAt,
            tcpMs: tcpAt,
            tlsMs: tlsAt,
            ttfbMs,
            ssl,
            headers: res.headers,
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

// The full Phase 1 website check: follows redirects (re-validated against the SSRF guard on
// every hop via fetchOnce -> checkLiteralIpNotRestricted + the lookup override), evaluates the
// expected status code and content rules, and extracts SSL info from the final HTTPS hop.
// Never persists the response body - only a bounded excerpt is ever held in memory, used
// solely for the keyword checks below, then discarded when this function returns.
export async function checkWebsite(config: WebsiteMonitorConfig, limits: MonitorCheckLimits): Promise<WebsiteCheckResult> {
  const overallStart = Date.now();
  let currentUrl = config.url;
  let redirectCount = 0;
  let firstDnsMs: number | null = null;
  let firstTcpMs: number | null = null;
  let firstTlsMs: number | null = null;
  let firstTtfbMs: number | null = null;

  try {
    for (;;) {
      const hop = await fetchOnce(currentUrl, config.httpMethod, config.sslVerify, limits);

      if (redirectCount === 0) {
        firstDnsMs = hop.dnsMs;
        firstTcpMs = hop.tcpMs;
        firstTlsMs = hop.tlsMs;
        firstTtfbMs = hop.ttfbMs;
      }

      const isRedirect = hop.statusCode >= 300 && hop.statusCode < 400 && hop.location;
      if (isRedirect && config.followRedirects && redirectCount < config.maxRedirects) {
        redirectCount += 1;
        currentUrl = new URL(hop.location as string, currentUrl).toString();
        continue;
      }

      const totalMs = Date.now() - overallStart;
      // A 429 proves the origin is alive and answering - it's the server saying "slow down",
      // not "I'm broken" - so it's treated the same as a status-code match rather than a
      // failure. Confirmed necessary on a real site whose Cloudflare rate-limiting returned an
      // explicit 429 + Retry-After to every checker (this one, check-host.net's regions, and an
      // unrelated network) even though the site itself was fully up.
      const statusMatches = hop.statusCode === config.expectedStatusCode || hop.statusCode === 429;

      let contentCheck = null;
      if (config.httpMethod === "GET" && hop.statusCode !== 429) {
        contentCheck = checkEmptyBody(hop.bodyExcerpt) ?? checkContent(hop.bodyExcerpt, config);
      }

      const success = statusMatches && (contentCheck === null || contentCheck.passed);
      const wafChallengeDetected = detectWafChallenge(hop.statusCode, hop.bodyExcerpt, hop.headers);

      return {
        success: success && !wafChallengeDetected,
        httpStatusCode: hop.statusCode,
        dnsMs: firstDnsMs,
        tcpMs: firstTcpMs,
        tlsMs: firstTlsMs,
        ttfbMs: firstTtfbMs,
        totalMs,
        responseSizeBytes: hop.totalBytesSeen,
        redirectCount,
        finalUrl: currentUrl,
        contentCheck,
        ssl: hop.ssl,
        errorCode: wafChallengeDetected ? "WAF_CHALLENGE" : statusMatches ? null : "UNEXPECTED_STATUS",
        errorMessage: wafChallengeDetected
          ? "Response looks like a WAF/anti-bot challenge page, not the site's real content."
          : statusMatches
            ? null
            : `Expected HTTP ${config.expectedStatusCode}, got ${hop.statusCode}.`,
        wafChallengeDetected,
      };
    }
  } catch (err) {
    const isBlocked = err instanceof SsrfBlockedError;
    return {
      success: false,
      httpStatusCode: null,
      dnsMs: null,
      tcpMs: null,
      tlsMs: null,
      ttfbMs: null,
      totalMs: Date.now() - overallStart,
      responseSizeBytes: null,
      redirectCount,
      finalUrl: currentUrl,
      contentCheck: null,
      ssl: null,
      errorCode: isBlocked ? "SSRF_BLOCKED" : "CONNECTION_ERROR",
      errorMessage: err instanceof Error ? err.message : "Connection failed.",
      wafChallengeDetected: false,
    };
  }
}
