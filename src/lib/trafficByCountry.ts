import { getDb } from "./db";

export interface CountryTraffic {
  country: string;
  pct: number;
}

// RFC1918 private ranges, loopback, link-local, and multicast - traffic to these isn't
// "a country", it's internal/local network chatter that would otherwise show up as noise.
const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^22[4-9]\./,
  /^23\d\./,
];

function isPublicIp(ip: string): boolean {
  if (!ip || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return false;
  return !PRIVATE_IP_PATTERNS.some((re) => re.test(ip));
}

// Bounds how many distinct destination IPs get geolocated per refresh - ip-api.com's free
// batch endpoint takes up to 100 IPs per request, so this is at most a handful of requests,
// and the top-N-by-connection-count IPs dominate the percentages anyway (a long tail of
// single-hit IPs wouldn't move the needle even if included).
const MAX_DISTINCT_IPS = 300;
const CACHE_TTL_MS = 20 * 60 * 1000;
// If geolocation comes back empty (rate-limited, transient network failure, etc.) while
// there was real traffic to classify, that's a failure, not a "nothing to show" state - so
// it gets a much shorter cache life than a genuine empty result, and self-heals on the next
// page load instead of leaving the widget looking broken for a full 20 minutes.
const FAILURE_CACHE_TTL_MS = 90 * 1000;

let cache: { result: CountryTraffic[]; fetchedAt: number; ttlMs: number } | null = null;

async function batchGeolocate(ips: string[]): Promise<Map<string, string>> {
  const chunks: string[][] = [];
  for (let i = 0; i < ips.length; i += 100) chunks.push(ips.slice(i, i + 100));

  const countryByIp = new Map<string, string>();
  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await fetch("http://ip-api.com/batch?fields=query,country,status", {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "logmonitor-dashboard/1.0" },
          body: JSON.stringify(chunk),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        return (await res.json()) as { query: string; country?: string; status: string }[];
      } catch {
        // One failed batch shouldn't block the others - those IPs just end up uncounted
        // rather than crashing the whole widget.
        return [];
      }
    })
  );
  for (const data of chunkResults) {
    for (const entry of data) {
      if (entry.status === "success" && entry.country) countryByIp.set(entry.query, entry.country);
    }
  }
  return countryByIp;
}

// Real traffic-by-country for the dashboard's right rail: merges the last 24h of outbound
// destination IPs seen by the MikroTik router (RouterWebLogs, from its WEBCONN syslog
// stream) and the Sophos firewall's web filter (WebFilterLogs), geolocates the busiest
// public destinations, and buckets everything past the top 3 countries into "Other".
// Cached in-memory for CACHE_TTL_MS since ip-api.com's free tier is rate-limited and this
// data doesn't need to be second-by-second fresh for a dashboard summary card.
export async function getTrafficByCountry(): Promise<CountryTraffic[]> {
  if (cache && Date.now() - cache.fetchedAt < cache.ttlMs) return cache.result;

  const db = await getDb();
  const [routerRes, sophosRes] = await Promise.all([
    db.query<{ DstIp: string; Cnt: number }>(`
      SELECT DstIp, COUNT(*) AS Cnt FROM RouterWebLogs
      WHERE ReceivedAt >= DATEADD(hour, -24, SYSUTCDATETIME()) AND DstIp IS NOT NULL
      GROUP BY DstIp
    `),
    db.query<{ DstIp: string; Cnt: number }>(`
      SELECT DstIp, COUNT(*) AS Cnt FROM WebFilterLogs
      WHERE ReceivedAt >= DATEADD(hour, -24, SYSUTCDATETIME()) AND DstIp IS NOT NULL
      GROUP BY DstIp
    `),
  ]);

  const counts = new Map<string, number>();
  for (const row of [...routerRes.recordset, ...sophosRes.recordset]) {
    if (!isPublicIp(row.DstIp)) continue;
    counts.set(row.DstIp, (counts.get(row.DstIp) ?? 0) + row.Cnt);
  }

  if (counts.size === 0) {
    // Genuinely nothing to classify - a real "no traffic" state, safe to cache for the
    // full TTL rather than re-querying the DB every page load.
    cache = { result: [], fetchedAt: Date.now(), ttlMs: CACHE_TTL_MS };
    return [];
  }

  const topIps = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_DISTINCT_IPS);
  const countryByIp = await batchGeolocate(topIps.map(([ip]) => ip));

  const countryTotals = new Map<string, number>();
  let grandTotal = 0;
  for (const [ip, count] of topIps) {
    const country = countryByIp.get(ip);
    if (!country) continue; // couldn't geolocate - excluded rather than mislabeled
    countryTotals.set(country, (countryTotals.get(country) ?? 0) + count);
    grandTotal += count;
  }

  if (grandTotal === 0) {
    // There WAS traffic to classify but geolocation returned nothing for all of it - almost
    // always a transient ip-api.com failure/rate-limit, not a real "no traffic" state. Cache
    // briefly so the widget retries soon instead of showing "no data" for a full 20 minutes.
    cache = { result: [], fetchedAt: Date.now(), ttlMs: FAILURE_CACHE_TTL_MS };
    return [];
  }

  const sorted = [...countryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 3);
  const otherTotal = sorted.slice(3).reduce((sum, [, c]) => sum + c, 0);

  const result: CountryTraffic[] = top.map(([country, count]) => ({ country, pct: Math.round((count / grandTotal) * 100) }));
  if (otherTotal > 0) result.push({ country: "Other", pct: Math.round((otherTotal / grandTotal) * 100) });

  cache = { result, fetchedAt: Date.now(), ttlMs: CACHE_TTL_MS };
  return result;
}
