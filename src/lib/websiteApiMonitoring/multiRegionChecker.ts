import https from "https";

// Real multi-region reachability, like Pingdom/UptimeRobot's "check from around the world" -
// this app has no infrastructure of its own in Europe/USA/India, so it uses check-host.net's
// free public probe network (no API key, no signup) instead of building one. Discovered after
// a single-vantage-point check (this app's own server) reported several genuinely-reachable
// sites as Down purely because of a local network issue (DNS interception for some domains,
// an outright blocked IP range for others) that had nothing to do with the sites themselves.
// check-host.net's probe list has no Nepal or Australia node (confirmed by fetching
// https://check-host.net/nodes/hosts and checking) - Europe/USA/India is the closest available
// match to what was asked for.
const REGION_NODES: { region: string; node: string }[] = [
  { region: "Europe", node: "nl1.node.check-host.net" },
  { region: "USA", node: "us1.node.check-host.net" },
  { region: "India", node: "in1.node.check-host.net" },
];

const CHECK_HOST = "check-host.net";
const POLL_INTERVAL_MS = 1200;
const MAX_POLL_ATTEMPTS = 6; // ~7s worst case on top of the initial request - keeps a due monitor's total check time bounded

export interface RegionCheckOutcome {
  region: string;
  node: string;
  success: boolean;
  httpStatusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

export interface MultiRegionCheckResult {
  // null when check-host.net itself couldn't be reached/queried at all (its own outage, or
  // this server's path to check-host.net specifically is blocked) - callers must fall back to
  // local-only reachability in that case rather than treating "no data" as Down.
  available: boolean;
  success: boolean;
  regions: RegionCheckOutcome[];
  avgResponseMs: number | null;
  httpStatusCode: number | null;
}

function httpsGetJson(hostname: string, path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get({ host: hostname, path, headers: { Accept: "application/json" }, timeout: 8000 }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Request to ${hostname}${path} timed out`)));
    req.on("error", reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// check-host.net's check-result response, per node, is an array of one result tuple:
// [ok(1|0), timeSeconds, "OK"|error string, httpStatusCodeAsString|null, resolvedIp]
type CheckResultTuple = [number, number, string, string | null, string];
type CheckResultResponse = Record<string, CheckResultTuple[] | null>;

export async function checkMultiRegion(url: string, expectedStatusCode: number, followRedirects: boolean): Promise<MultiRegionCheckResult> {
  const nodeParams = REGION_NODES.map((r) => `node=${encodeURIComponent(r.node)}`).join("&");

  let requestId: string;
  try {
    const initial = (await httpsGetJson(CHECK_HOST, `/check-http?host=${encodeURIComponent(url)}&${nodeParams}`)) as {
      ok?: number;
      request_id?: string;
    };
    if (!initial.ok || !initial.request_id) throw new Error("check-host.net did not accept the check request");
    requestId = initial.request_id;
  } catch {
    return { available: false, success: false, regions: [], avgResponseMs: null, httpStatusCode: null };
  }

  let resultData: CheckResultResponse | null = null;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const polled = (await httpsGetJson(CHECK_HOST, `/check-result/${requestId}`)) as CheckResultResponse;
      const allReported = REGION_NODES.every((r) => polled[r.node] != null);
      resultData = polled;
      if (allReported) break;
    } catch {
      // Transient poll failure - keep trying until MAX_POLL_ATTEMPTS is exhausted.
    }
  }

  if (!resultData) {
    return { available: false, success: false, regions: [], avgResponseMs: null, httpStatusCode: null };
  }

  const regions: RegionCheckOutcome[] = REGION_NODES.map(({ region, node }) => {
    const tuple = resultData![node]?.[0];
    if (!tuple) {
      return { region, node, success: false, httpStatusCode: null, responseTimeMs: null, error: "No response from this region within the check window." };
    }
    const [ok, timeSeconds, message, statusCodeStr] = tuple;
    const statusCode = statusCodeStr ? Number(statusCodeStr) : null;
    // check-host.net's check-http does a single request per node - unlike the local checker,
    // it never follows redirects itself, so a monitor configured with followRedirects=true
    // legitimately sees its own 30x here every time (e.g. a bare-domain -> https/www redirect).
    // Without this, every normal redirecting site would falsely report Down from every region.
    const isRedirect = statusCode !== null && statusCode >= 300 && statusCode < 400;
    // A 429 proves the origin is alive and answering - it's the server saying "slow down", not
    // "I'm broken". A site with request-rate limiting can easily return 429 to a monitoring
    // probe (three independent regions checking it, plus the local check, all within the same
    // few seconds looks exactly like the burst such limits exist to catch) even though it's
    // completely reachable and working for real visitors. Treating that as a hard Down was
    // confirmed to be wrong on a real site: curl from an unrelated network hit the exact same
    // 429 with a Retry-After header and an explicit "Access denied" rate-limit body - not a
    // timeout, not a connection failure, not a bot/JS challenge page.
    // Deliberately NOT gated behind `ok === 1` like the other cases above - check-host.net's
    // own `ok` flag is 0 for a 429 response (it counts that as its own failure category, not a
    // successful-but-unexpected status like a redirect), so a check gated on ok===1 would never
    // see this override apply at all.
    const isRateLimited = statusCode === 429;
    const success = isRateLimited || (ok === 1 && (statusCode === expectedStatusCode || (followRedirects && isRedirect)));
    return {
      region,
      node,
      success,
      httpStatusCode: statusCode,
      responseTimeMs: Math.round(timeSeconds * 1000),
      error: success ? null : ok === 1 ? `Expected HTTP ${expectedStatusCode}, got ${statusCode}.` : message,
    };
  });

  const successCount = regions.filter((r) => r.success).length;
  const successfulTimes = regions.filter((r) => r.success && r.responseTimeMs !== null).map((r) => r.responseTimeMs as number);
  const avgResponseMs = successfulTimes.length > 0 ? Math.round(successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length) : null;
  const firstStatusCode = regions.find((r) => r.httpStatusCode !== null)?.httpStatusCode ?? null;

  return {
    available: true,
    // Majority vote across the 3 regions - a single region's local network issue (the entire
    // reason this feature exists) can never flip the whole monitor to Down on its own.
    success: successCount >= Math.ceil(REGION_NODES.length / 2),
    regions,
    avgResponseMs,
    httpStatusCode: firstStatusCode,
  };
}
