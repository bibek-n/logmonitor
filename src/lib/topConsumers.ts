import { getDb, sql } from "./db";

// Admin-configured, per-deployment infrastructure IPs (Settings > Company Profile) to exclude
// from traffic rankings - the firewall's own address, the router's own management interfaces, a
// VPN concentrator, extra AP/switch appliances, whatever a given company's own network happens
// to have. NULL/unset (safe default - nothing excluded) rather than a hardcoded IP list, since a
// list correct for one company's network is meaningless, or actively wrong (could hide a real
// device), on someone else's. Stored as one comma/newline-separated string per field; only
// well-formed IPv4-looking tokens are kept; filtered of anything else so this can never widen
// into arbitrary SQL via the admin text field (these are interpolated directly into IN (...)
// clauses below, same as the hardcoded literals this replaces).
const IPV4_PATTERN = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
function parseIpList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => IPV4_PATTERN.test(s));
}

interface NetworkExclusions {
  // Firewall/router self-traffic only - used alone for the total-bandwidth-estimate exclusion
  // (that traffic is real and should still count toward a total, unlike the broader ranking set).
  firewallSelfIps: string[];
  // Union of firewallSelfIps plus every other non-staff infrastructure/aggregation-point IP, for
  // any ranking meant to represent staff/client activity (Top IPs, Top Active Devices, Top
  // Router Clients, etc.).
  nonStaffInfrastructureIps: string[];
}

export async function getNetworkExclusions(): Promise<NetworkExclusions> {
  const db = await getDb();
  const result = await db.query<{ FirewallSelfIps: string | null; RankingExcludedInfraIps: string | null }>`
    SELECT FirewallSelfIps, RankingExcludedInfraIps FROM CompanySettings WHERE Id = 1
  `;
  const row = result.recordset[0];
  const firewallSelfIps = parseIpList(row?.FirewallSelfIps ?? null);
  const rankingExcludedIps = parseIpList(row?.RankingExcludedInfraIps ?? null);
  return { firewallSelfIps, nonStaffInfrastructureIps: [...firewallSelfIps, ...rankingExcludedIps] };
}

// SQL IN (...) clause body ("'a', 'b'") for a list already validated by parseIpList above - safe
// to interpolate directly since every entry is guaranteed IPv4-shaped (no quotes/special chars
// possible), same reasoning the hardcoded literals this replaces always relied on. Exported so
// other callers of getNetworkExclusions() (e.g. the Overview page's Top Active Devices widget)
// don't have to re-implement the same empty-list guard.
export function ipInClause(ips: string[]): string {
  return ips.length > 0 ? ips.map((ip) => `'${ip}'`).join(", ") : "''"; // never a bare empty IN ()
}

export interface TopIpRow {
  ip: string;
  name: string | null;
  totalBytes: number;
  requests: number;
}
export interface TopWebsiteRow {
  website: string;
  totalBytes: number;
  requests: number;
}
export interface TopUserRow {
  user: string;
  totalBytes: number;
  requests: number;
}
export interface TopServerRow {
  device: string;
  avgNetMbps: number;
  maxNetMbps: number;
}
export interface TopRouterClientRow {
  ip: string;
  name: string | null;
  totalBytes: number;
  flows: number;
}

// Sophos leaves Domain null on most/all rows in practice (only Url is reliably populated) -
// same fallback as sophosWebFilterAdapter.ts's collectSophosWebFilter, replicated here rather
// than importing from that module since it's a private four-line helper, not a shared export.
function extractHostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// Resolves a Sophos-side IP (192.168.1.x) to a staff name, trying two paths since Staff itself
// only carries a MacAddress (no IP column): (1) SophosClients' MAC directly against
// Staff.MacAddress, for staff whose device MAC was entered manually; (2) SophosClients' MAC or
// IP against Devices (the endpoint-agent inventory, which self-reports both LastIp/
// StaticIpAddress and MacAddress) joined to its StaffId - covers agent-enrolled staff even when
// nobody ever manually filled in Staff.MacAddress. UNION (not UNION ALL) since a device could
// satisfy both paths with the same resolved name.
export async function getIpToStaffNameMap(): Promise<Map<string, string>> {
  const db = await getDb();
  const result = await db.query<{ IpAddress: string; Name: string }>(`
    SELECT sc.IpAddress, s.Name FROM SophosClients sc
    JOIN Staff s ON s.MacAddress = sc.MacAddress
    WHERE sc.MacAddress IS NOT NULL

    UNION

    SELECT sc.IpAddress, s.Name
    FROM SophosClients sc
    JOIN Devices d ON d.MacAddress = sc.MacAddress OR d.LastIp = sc.IpAddress OR d.StaticIpAddress = sc.IpAddress
    JOIN Staff s ON s.Id = d.StaffId
    WHERE d.StaffId IS NOT NULL
  `);
  return new Map(result.recordset.map((r) => [r.IpAddress, r.Name]));
}

export async function getTopIps(hours: number, limit: number): Promise<TopIpRow[]> {
  const db = await getDb();
  const [{ nonStaffInfrastructureIps }, nameByIp] = await Promise.all([getNetworkExclusions(), getIpToStaffNameMap()]);
  const result = await db
    .request()
    .input("hours", sql.Int, hours)
    .query<{ SrcIp: string; TotalBytes: number; Requests: number }>(`
      SELECT TOP ${limit} SrcIp,
        SUM(ISNULL(BytesSent, 0) + ISNULL(BytesReceived, 0)) AS TotalBytes,
        COUNT(*) AS Requests
      FROM WebFilterLogs
      WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME()) AND SrcIp IS NOT NULL
        AND SrcIp NOT IN (${ipInClause(nonStaffInfrastructureIps)})
      GROUP BY SrcIp
      ORDER BY TotalBytes DESC
    `);
  // mssql returns BIGINT columns (TotalBytes, from SUM over a BIGINT column) as a JS string,
  // not a number, to avoid silent precision loss above Number.MAX_SAFE_INTEGER - explicit
  // Number(...) here so callers get a real number rather than a string that happens to work by
  // luck in relational comparisons but breaks the moment anything does arithmetic on it.
  return result.recordset.map((r) => ({ ip: r.SrcIp, name: nameByIp.get(r.SrcIp) ?? null, totalBytes: Number(r.TotalBytes), requests: r.Requests }));
}

export interface CurrentBandwidthRate {
  incomingBps: number;
  outgoingBps: number;
  // "interface" = accurate, firewall-self-reported WAN throughput (all protocols).
  // "webfilter" = fallback estimate from proxied HTTP/HTTPS bytes only, used when the firewall
  // hasn't pushed an interface reading recently.
  source: "interface" | "webfilter";
}

// Reads the Sophos firewall's own self-reported WAN interface throughput when available - the
// firewall pushes a "System Health / Interface / Usage" syslog message for every physical
// interface (SystemHealthLogs, handleSystemHealth in syslog/listener.ts); Port2 is the WAN
// uplink on this box. In practice this health message arrives sporadically (observed gaps of
// 40+ minutes), so when it's stale this falls back to estimating from WebFilterLogs - that only
// covers proxied HTTP/HTTPS traffic and undercounts true throughput. WebFilterLogs also writes
// one row per completed request rather than a continuous byte counter, so it arrives in bursts
// (observed as few as ~7 rows across 5 minutes) - a short window very often catches nothing and
// reads as ~0, so the fallback window is 5 minutes to smooth that burstiness into a usable average.
const WAN_INTERFACE_NAME = "Port2";
const INTERFACE_STALE_AFTER_SECONDS = 120;
const WEBFILTER_FALLBACK_WINDOW_SECONDS = 5 * 60;

async function getInterfaceBandwidthRate(): Promise<{ incomingBps: number; outgoingBps: number } | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("interfaceName", sql.NVarChar, WAN_INTERFACE_NAME)
    .input("staleAfterSeconds", sql.Int, INTERFACE_STALE_AFTER_SECONDS)
    .query<{ ReceivedKbits: string | null; TransmittedKbits: string | null }>(`
      SELECT TOP 1 JSON_VALUE(Fields, '$.receivedkbits') AS ReceivedKbits, JSON_VALUE(Fields, '$.transmittedkbits') AS TransmittedKbits
      FROM SystemHealthLogs
      WHERE LogComponent = 'Interface' AND LogSubtype = 'Usage'
        AND JSON_VALUE(Fields, '$.interface') = @interfaceName
        AND ReceivedAt >= DATEADD(SECOND, -@staleAfterSeconds, SYSUTCDATETIME())
      ORDER BY Id DESC
    `);
  const row = result.recordset[0];
  if (!row) return null;
  const receivedKbits = Number(row.ReceivedKbits ?? 0);
  const transmittedKbits = Number(row.TransmittedKbits ?? 0);
  return { incomingBps: (receivedKbits * 1000) / 8, outgoingBps: (transmittedKbits * 1000) / 8 };
}

async function getWebFilterBandwidthEstimate(): Promise<{ incomingBps: number; outgoingBps: number }> {
  const db = await getDb();
  const { firewallSelfIps } = await getNetworkExclusions();
  const result = await db
    .request()
    .input("windowSeconds", sql.Int, WEBFILTER_FALLBACK_WINDOW_SECONDS)
    .query<{ IncomingBytes: string | null; OutgoingBytes: string | null }>(`
      SELECT SUM(ISNULL(BytesReceived, 0)) AS IncomingBytes, SUM(ISNULL(BytesSent, 0)) AS OutgoingBytes
      FROM WebFilterLogs
      WHERE ReceivedAt >= DATEADD(SECOND, -@windowSeconds, SYSUTCDATETIME()) AND SrcIp IS NOT NULL
        AND SrcIp NOT IN (${ipInClause(firewallSelfIps)})
    `);
  const row = result.recordset[0];
  const incomingBytes = Number(row?.IncomingBytes ?? 0);
  const outgoingBytes = Number(row?.OutgoingBytes ?? 0);
  return {
    incomingBps: incomingBytes / WEBFILTER_FALLBACK_WINDOW_SECONDS,
    outgoingBps: outgoingBytes / WEBFILTER_FALLBACK_WINDOW_SECONDS,
  };
}

export async function getCurrentSophosBandwidthRate(): Promise<CurrentBandwidthRate> {
  const interfaceRate = await getInterfaceBandwidthRate();
  if (interfaceRate) return { ...interfaceRate, source: "interface" };
  const fallback = await getWebFilterBandwidthEstimate();
  return { ...fallback, source: "webfilter" };
}

// Grouped in JS rather than SQL, since the grouping key (Domain when present, else a hostname
// extracted from Url) isn't a plain column SQL can GROUP BY directly - fetches raw rows off the
// ReceivedAt covering index (bounded to a generous cap so one very chatty window can't return an
// unbounded result set) and aggregates here. ORDER BY ReceivedAt DESC so, when the cap is hit,
// it's always the most recent rows in the window that get sampled rather than an arbitrary
// engine-chosen slice - confirmed live that without this, the cap could be entirely consumed by
// one extremely high-frequency near-zero-byte domain before ever reaching bandwidth-heavy sites.
export async function getTopWebsites(hours: number, limit: number): Promise<TopWebsiteRow[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("hours", sql.Int, hours)
    .query<{ Domain: string | null; Url: string | null; BytesSent: string | null; BytesReceived: string | null }>(`
      SELECT TOP 200000 Domain, Url, BytesSent, BytesReceived
      FROM WebFilterLogs
      WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
      ORDER BY ReceivedAt DESC
    `);

  const totals = new Map<string, { totalBytes: number; requests: number }>();
  for (const r of result.recordset) {
    const site = r.Domain || extractHostname(r.Url);
    if (!site) continue;
    // BytesSent/BytesReceived are BIGINT - mssql returns them as strings, so Number(...) is
    // required before +, same reasoning as getTopIps above (the concrete bug this fixes: string
    // "+" concatenates rather than adds, which produced a corrupted thousands-of-digits value
    // here before this fix).
    const bytes = Number(r.BytesSent ?? 0) + Number(r.BytesReceived ?? 0);
    const existing = totals.get(site) ?? { totalBytes: 0, requests: 0 };
    existing.totalBytes += bytes;
    existing.requests += 1;
    totals.set(site, existing);
  }

  return [...totals.entries()]
    .map(([website, v]) => ({ website, ...v }))
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, limit);
}

export interface TopVisitedRow {
  name: string;
  source: "sophos" | "mikrotik";
  requests: number;
  // 0 for MikroTik rows - RouterWebLogs is a raw WEBCONN connection log (no byte counters),
  // unlike WebFilterLogs which has per-request BytesSent/BytesReceived.
  totalBytes: number;
}

// Combined "top visited" list across both firewall sources - NOT a true merge like
// getTopBandwidthStaff (there's no shared identity to join on): Sophos identifies sites by
// Domain (from real web-filter/URL categorization), while the MikroTik only logs raw WEBCONN
// connections with a reverse-DNS lookup of the destination IP (ReverseDns) - often a cloud
// hostname (e.g. "ec2-...amazonaws.com") rather than the actual site name, since MikroTik
// doesn't do the deep packet inspection Sophos does. So each source's top-N is fetched
// separately, tagged with its source, and interleaved by request count rather than pretending
// "facebook.com" (Sophos) and some EC2 reverse-DNS entry (MikroTik) are ever the same row.
// WebFilterLogs.Application/ApplicationCategory (a distinct "visiting application" signal) is
// intentionally not used here - confirmed live that Sophos never actually populates it via this
// log format (0 of ~1,900 rows in a sample day), so Domain is the only real signal available.
export async function getTopVisited(hours: number, limit: number): Promise<TopVisitedRow[]> {
  const db = await getDb();
  const [sophosResult, routerResult] = await Promise.all([
    db
      .request()
      .input("hours", sql.Int, hours)
      .query<{ Domain: string; Requests: number; TotalBytes: string | null }>(`
        SELECT TOP ${limit} Domain,
          COUNT(*) AS Requests,
          SUM(ISNULL(BytesSent, 0) + ISNULL(BytesReceived, 0)) AS TotalBytes
        FROM WebFilterLogs
        WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME()) AND Domain IS NOT NULL AND Domain <> ''
        GROUP BY Domain
        ORDER BY Requests DESC
      `),
    db
      .request()
      .input("hours", sql.Int, hours)
      .query<{ ReverseDns: string; Requests: number }>(`
        SELECT TOP ${limit} ReverseDns, COUNT(*) AS Requests
        FROM RouterWebLogs
        WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME()) AND ReverseDns IS NOT NULL AND ReverseDns <> ''
        GROUP BY ReverseDns
        ORDER BY Requests DESC
      `),
  ]);

  const sophosRows: TopVisitedRow[] = sophosResult.recordset.map((r) => ({
    name: r.Domain,
    source: "sophos",
    requests: r.Requests,
    totalBytes: Number(r.TotalBytes ?? 0),
  }));
  const routerRows: TopVisitedRow[] = routerResult.recordset.map((r) => ({
    name: r.ReverseDns,
    source: "mikrotik",
    requests: r.Requests,
    totalBytes: 0,
  }));

  return [...sophosRows, ...routerRows].sort((a, b) => b.requests - a.requests).slice(0, limit);
}

export async function getTopUsers(hours: number, limit: number): Promise<TopUserRow[]> {
  const db = await getDb();
  const [result, nameByIp] = await Promise.all([
    db
      .request()
      .input("hours", sql.Int, hours)
      .query<{ SrcIp: string | null; UserName: string | null; BytesSent: string | null; BytesReceived: string | null }>(`
        SELECT TOP 200000 SrcIp, UserName, BytesSent, BytesReceived
        FROM WebFilterLogs
        WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
        ORDER BY ReceivedAt DESC
      `),
    getIpToStaffNameMap(),
  ]);

  const totals = new Map<string, { totalBytes: number; requests: number }>();
  for (const r of result.recordset) {
    // Prefer a real Sophos-authenticated username when present; otherwise resolve the source
    // IP to a staff name the same way Top IPs does. Rows that resolve to neither are skipped
    // rather than lumped into an "Unknown" bucket that would just be noise at this scale.
    const user = r.UserName || (r.SrcIp ? nameByIp.get(r.SrcIp) : null);
    if (!user) continue;
    // BytesSent/BytesReceived are BIGINT - mssql returns them as strings, so Number(...) is
    // required before + (same bug/fix as getTopWebsites above).
    const bytes = Number(r.BytesSent ?? 0) + Number(r.BytesReceived ?? 0);
    const existing = totals.get(user) ?? { totalBytes: 0, requests: 0 };
    existing.totalBytes += bytes;
    existing.requests += 1;
    totals.set(user, existing);
  }

  return [...totals.entries()]
    .map(([user, v]) => ({ user, ...v }))
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, limit);
}

// Ranked by network bandwidth (not CPU) to match this whole feature's "who/what is consuming
// the most traffic" theme - a separate concern from the AI Assistant's get_top_cpu_usage tool,
// which is about compute load, not network consumption.
export async function getTopServers(hours: number, limit: number): Promise<TopServerRow[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("hours", sql.Int, hours)
    .query<{ DeviceName: string | null; Hostname: string; AvgNet: number | null; MaxNet: number | null }>(`
      SELECT TOP ${limit} d.DeviceName, d.Hostname,
        AVG(m.NetRxMbps + m.NetTxMbps) AS AvgNet,
        MAX(m.NetRxMbps + m.NetTxMbps) AS MaxNet
      FROM DeviceMetrics m
      JOIN Devices d ON d.DeviceId = m.DeviceId
      WHERE d.DeviceType = 'Server' AND m.ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
      GROUP BY d.DeviceName, d.Hostname
      ORDER BY MAX(m.NetRxMbps + m.NetTxMbps) DESC
    `);
  return result.recordset.map((r) => ({
    device: r.DeviceName ?? r.Hostname,
    avgNetMbps: Math.round((r.AvgNet ?? 0) * 100) / 100,
    maxNetMbps: Math.round((r.MaxNet ?? 0) * 100) / 100,
  }));
}

// Resolves a router-side client IP to a staff name directly via RouterClients' own
// MacAddress column (unlike getIpToStaffNameMap above, no SophosClients intermediary needed -
// RouterClients already carries both IpAddress and MacAddress from the DHCP lease list).
export async function getIpToStaffNameMapViaRouter(): Promise<Map<string, string>> {
  const db = await getDb();
  const result = await db.query<{ IpAddress: string; Name: string }>(`
    SELECT rc.IpAddress, s.Name FROM RouterClients rc
    JOIN Staff s ON s.MacAddress = rc.MacAddress
    WHERE rc.MacAddress IS NOT NULL
  `);
  return new Map(result.recordset.map((r) => [r.IpAddress, r.Name]));
}

async function getIpToRouterHostnameMap(): Promise<Map<string, string>> {
  const db = await getDb();
  const result = await db.query<{ IpAddress: string; Hostname: string | null }>("SELECT IpAddress, Hostname FROM RouterClients");
  return new Map(result.recordset.filter((r) => r.Hostname).map((r) => [r.IpAddress, r.Hostname as string]));
}

// Ranked by total bytes attributed to each known MikroTik DHCP client (RouterClients.IpAddress)
// found on either side of a /ip accounting flow - a flow's bytes count toward a client whether
// that client was the src (their own upload) or dst (their own download), same "combined
// upload+download total" semantics getTopIps uses for BytesSent+BytesReceived. Non-local IPs
// (the internet side of every flow) are never ranked here, only the LAN client each flow
// touches - see RouterClientTraffic's migration comment for why this table exists at all
// (MikroTik's DHCP lease list has no traffic-volume columns whatsoever). Flows touching
// configured infrastructure IPs (Settings > Company Profile) are excluded entirely (not counted
// toward the client on the other end) - a client configuring the router isn't "consuming
// bandwidth" in the sense this ranking is trying to measure.
export async function getTopRouterClients(hours: number, limit: number): Promise<TopRouterClientRow[]> {
  const db = await getDb();
  const { nonStaffInfrastructureIps } = await getNetworkExclusions();
  const managementIpList = ipInClause(nonStaffInfrastructureIps);
  const [result, staffNameByIp, hostnameByIp] = await Promise.all([
    db.request().input("hours", sql.Int, hours).query<{ ClientIp: string; TotalBytes: string; Flows: number }>(`
      ;WITH Attributed AS (
        SELECT t.SrcAddress AS ClientIp, t.Bytes
        FROM RouterClientTraffic t
        WHERE t.ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
          AND EXISTS (SELECT 1 FROM RouterClients rc WHERE rc.IpAddress = t.SrcAddress)
          AND t.DstAddress NOT IN (${managementIpList})
        UNION ALL
        SELECT t.DstAddress AS ClientIp, t.Bytes
        FROM RouterClientTraffic t
        WHERE t.ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
          AND EXISTS (SELECT 1 FROM RouterClients rc WHERE rc.IpAddress = t.DstAddress)
          AND t.SrcAddress NOT IN (${managementIpList})
      )
      SELECT TOP ${limit} ClientIp, SUM(Bytes) AS TotalBytes, COUNT(*) AS Flows
      FROM Attributed
      GROUP BY ClientIp
      ORDER BY TotalBytes DESC
    `),
    getIpToStaffNameMapViaRouter(),
    getIpToRouterHostnameMap(),
  ]);
  return result.recordset.map((r) => ({
    ip: r.ClientIp,
    name: staffNameByIp.get(r.ClientIp) ?? hostnameByIp.get(r.ClientIp) ?? null,
    totalBytes: Number(r.TotalBytes),
    flows: r.Flows,
  }));
}

export interface TopBandwidthStaffRow {
  name: string;
  ipAddresses: string[];
  totalBytes: number;
}

// Combines both network sources into one per-staff ranking (unlike getTopIps/getTopRouterClients
// above, which each only see their own side) - a staff member can carry traffic on both the
// Sophos-side (192.168.1.x) and MikroTik-side (192.168.20.x) address spaces simultaneously, so
// their totals from each are summed together rather than shown as two separate, lower-ranked
// entries. Fetches full unaggregated-by-staff per-IP totals from both sources (no TOP N at the
// SQL level) so the staff-level merge below sees everything before truncating to `limit` -
// truncating per-source first could drop an entry that's only large after combining both.
// Staff-only by design: an IP that doesn't resolve to a known staff MAC on either network is
// excluded rather than shown as a bare IP, matching the "top bandwidth using staff" framing.
export async function getTopBandwidthStaff(hours: number, limit: number): Promise<TopBandwidthStaffRow[]> {
  const db = await getDb();
  const { firewallSelfIps, nonStaffInfrastructureIps } = await getNetworkExclusions();
  const managementIpList = ipInClause(nonStaffInfrastructureIps);

  const [sophosResult, routerResult, sophosNameByIp, routerNameByIp] = await Promise.all([
    db
      .request()
      .input("hours", sql.Int, hours)
      .query<{ SrcIp: string; TotalBytes: string }>(`
        SELECT SrcIp, SUM(ISNULL(BytesSent, 0) + ISNULL(BytesReceived, 0)) AS TotalBytes
        FROM WebFilterLogs
        WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME()) AND SrcIp IS NOT NULL
          AND SrcIp NOT IN (${ipInClause(firewallSelfIps)})
        GROUP BY SrcIp
      `),
    db
      .request()
      .input("hours", sql.Int, hours)
      .query<{ ClientIp: string; TotalBytes: string }>(`
        ;WITH Attributed AS (
          SELECT t.SrcAddress AS ClientIp, t.Bytes
          FROM RouterClientTraffic t
          WHERE t.ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
            AND EXISTS (SELECT 1 FROM RouterClients rc WHERE rc.IpAddress = t.SrcAddress)
            AND t.DstAddress NOT IN (${managementIpList})
          UNION ALL
          SELECT t.DstAddress AS ClientIp, t.Bytes
          FROM RouterClientTraffic t
          WHERE t.ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME())
            AND EXISTS (SELECT 1 FROM RouterClients rc WHERE rc.IpAddress = t.DstAddress)
            AND t.SrcAddress NOT IN (${managementIpList})
        )
        SELECT ClientIp, SUM(Bytes) AS TotalBytes FROM Attributed GROUP BY ClientIp
      `),
    getIpToStaffNameMap(),
    getIpToStaffNameMapViaRouter(),
  ]);

  const perStaff = new Map<string, { totalBytes: number; ipAddresses: Set<string> }>();
  const accumulate = (name: string | undefined, ip: string, bytes: number) => {
    if (!name) return;
    const entry = perStaff.get(name) ?? { totalBytes: 0, ipAddresses: new Set<string>() };
    entry.totalBytes += bytes;
    entry.ipAddresses.add(ip);
    perStaff.set(name, entry);
  };

  for (const r of sophosResult.recordset) accumulate(sophosNameByIp.get(r.SrcIp), r.SrcIp, Number(r.TotalBytes));
  for (const r of routerResult.recordset) accumulate(routerNameByIp.get(r.ClientIp), r.ClientIp, Number(r.TotalBytes));

  return [...perStaff.entries()]
    .map(([name, v]) => ({ name, ipAddresses: [...v.ipAddresses], totalBytes: v.totalBytes }))
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, limit);
}


