import http from "http";
import https from "https";
import { checkLiteralIpNotRestricted, createSafeLookup, SsrfBlockedError } from "./ssrfGuard";
import { evaluateAssertions } from "./apiAssertions";
import { getOAuth2AccessToken } from "./oauth2";
import { ApiCheckResult, ApiMonitorConfig, MonitorCheckLimits } from "./types";

const USER_AGENT_DEFAULT = "LogMonitor-ApiMonitor/1.0";

interface HopResult {
  statusCode: number;
  location: string | null;
  body: string;
  totalBytesSeen: number;
  dnsMs: number;
  tcpMs: number;
  ttfbMs: number;
}

function buildUrlWithQuery(baseUrl: string, queryParams: { key: string; value: string }[]): URL {
  const u = new URL(baseUrl);
  for (const p of queryParams) u.searchParams.append(p.key, p.value);
  return u;
}

// Resolves the auth type into the header(s)/query param it contributes - the one place that
// ever sees a decrypted secret in transit, immediately consumed into an outgoing request and
// never logged or persisted anywhere.
async function resolveAuth(config: ApiMonitorConfig, monitorId: number): Promise<{ extraQueryParams: { key: string; value: string }[]; extraHeaders: Record<string, string> }> {
  switch (config.authConfig.type) {
    case "None":
      return { extraQueryParams: [], extraHeaders: {} };
    case "ApiKey": {
      const { keyLocation, keyName, keyValue } = config.authConfig;
      return keyLocation === "query"
        ? { extraQueryParams: [{ key: keyName, value: keyValue }], extraHeaders: {} }
        : { extraQueryParams: [], extraHeaders: { [keyName]: keyValue } };
    }
    case "BearerToken":
      return { extraQueryParams: [], extraHeaders: { Authorization: `Bearer ${config.authConfig.token}` } };
    case "BasicAuth": {
      const encoded = Buffer.from(`${config.authConfig.username}:${config.authConfig.password}`).toString("base64");
      return { extraQueryParams: [], extraHeaders: { Authorization: `Basic ${encoded}` } };
    }
    case "OAuth2ClientCredentials": {
      const token = await getOAuth2AccessToken(monitorId, config.authConfig);
      return { extraQueryParams: [], extraHeaders: { Authorization: `Bearer ${token}` } };
    }
  }
}

function fetchOnce(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  requestBody: string | null,
  sslVerify: boolean,
  limits: MonitorCheckLimits
): Promise<HopResult> {
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

    const bodyBuffer = requestBody !== null && method !== "HEAD" ? Buffer.from(requestBody, "utf8") : null;
    const finalHeaders: Record<string, string> = { "User-Agent": USER_AGENT_DEFAULT, Accept: "application/json, text/plain, */*", ...headers };
    if (bodyBuffer) finalHeaders["Content-Length"] = String(bodyBuffer.length);

    // Same autoSelectFamily/lookup-hook fix as websiteChecker.ts - see that file's comment for
    // why this is required (Node's Happy Eyeballs default is incompatible with the SSRF guard's
    // custom `lookup` option, which only ever returns a single address).
    const requestOptions: https.RequestOptions & { autoSelectFamily?: boolean } = {
      method,
      headers: finalHeaders,
      timeout: limits.timeoutMs,
      rejectUnauthorized: isHttps ? sslVerify : undefined,
      lookup: createSafeLookup(),
      autoSelectFamily: false,
    };

    const req = (isHttps ? https : http).request(targetUrl, requestOptions, (res) => {
      const ttfbMs = Date.now() - t0;
      let totalBytesSeen = 0;
      const chunks: Buffer[] = [];

      res.on("data", (chunk: Buffer) => {
        if (req.destroyed) return;
        totalBytesSeen += chunk.length;
        if (totalBytesSeen > limits.maxResponseBytes) {
          res.destroy();
          req.destroy(new Error("Response exceeded the configured size limit."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        resolvePromise({
          statusCode: res.statusCode ?? 0,
          location: typeof res.headers.location === "string" ? res.headers.location : null,
          body: Buffer.concat(chunks).toString("utf8"),
          totalBytesSeen,
          dnsMs: dnsAt,
          tcpMs: tcpAt,
          ttfbMs,
        });
      });
      res.on("error", reject);
    });

    req.on("socket", (socket) => {
      socket.on("lookup", () => {
        dnsAt = Date.now() - t0;
      });
      socket.on("connect", () => {
        tcpAt = Date.now() - t0 - dnsAt;
      });
    });

    req.on("timeout", () => req.destroy(new Error("Request timed out.")));
    req.on("error", (err) => reject(err));
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

// The full API check: resolves auth (incl. an OAuth2 client-credentials token fetch/cache),
// builds headers/query params/body, follows redirects up to maxRedirects (re-validating the
// SSRF guard on every hop, exactly like websiteChecker.ts), evaluates the expected status code,
// and runs any configured JSONPath assertions against the final response body. Never persists
// the response body - only the bounded assertion results (pass/fail/actual value) are returned.
export async function checkApi(config: ApiMonitorConfig, limits: MonitorCheckLimits): Promise<ApiCheckResult> {
  const overallStart = Date.now();
  let redirectCount = 0;
  let firstDnsMs: number | null = null;
  let firstTcpMs: number | null = null;
  let firstTtfbMs: number | null = null;
  let currentUrl = config.url;

  try {
    const auth = await resolveAuth(config, config.monitorId);
    const initialUrl = buildUrlWithQuery(config.url, [...config.queryParams, ...auth.extraQueryParams]);

    const headers: Record<string, string> = { ...auth.extraHeaders };
    for (const h of config.headers) headers[h.key] = h.value;
    if (config.requestBody !== null && config.httpMethod !== "HEAD" && !Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
      headers["Content-Type"] = config.requestBodyContentType ?? "application/json";
    }

    currentUrl = initialUrl.toString();
    for (;;) {
      const hop = await fetchOnce(currentUrl, config.httpMethod, headers, config.requestBody, config.sslVerify, limits);

      if (redirectCount === 0) {
        firstDnsMs = hop.dnsMs;
        firstTcpMs = hop.tcpMs;
        firstTtfbMs = hop.ttfbMs;
      }

      const isRedirect = hop.statusCode >= 300 && hop.statusCode < 400 && hop.location;
      if (isRedirect && config.followRedirects && redirectCount < config.maxRedirects) {
        redirectCount += 1;
        currentUrl = new URL(hop.location as string, currentUrl).toString();
        continue;
      }

      const totalMs = Date.now() - overallStart;
      // A 429 proves the origin is alive and answering, not that it's broken - same reasoning
      // as websiteChecker.ts/multiRegionChecker.ts, confirmed necessary on a real site's
      // Cloudflare rate-limiting during this session.
      const statusMatches = hop.statusCode === config.expectedStatusCode || hop.statusCode === 429;
      const assertionResults = hop.statusCode !== 429 ? evaluateAssertions(hop.body, config.assertions) : [];
      const assertionsPassed = assertionResults.every((a) => a.passed);
      const success = statusMatches && assertionsPassed;

      let errorCode: string | null = null;
      let errorMessage: string | null = null;
      if (!success) {
        if (!statusMatches) {
          errorCode = "UNEXPECTED_STATUS";
          errorMessage = `Expected HTTP ${config.expectedStatusCode}, got ${hop.statusCode}.`;
        } else {
          errorCode = "ASSERTION_FAILED";
          errorMessage = assertionResults.find((a) => !a.passed)?.reason ?? "One or more assertions failed.";
        }
      }

      return {
        success,
        httpStatusCode: hop.statusCode,
        dnsMs: firstDnsMs,
        tcpMs: firstTcpMs,
        tlsMs: null,
        ttfbMs: firstTtfbMs,
        totalMs,
        responseSizeBytes: hop.totalBytesSeen,
        redirectCount,
        finalUrl: currentUrl,
        assertionResults,
        errorCode,
        errorMessage,
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
      assertionResults: [],
      errorCode: isBlocked ? "SSRF_BLOCKED" : "CONNECTION_ERROR",
      errorMessage: err instanceof Error ? err.message : "Connection failed.",
    };
  }
}
