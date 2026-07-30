import { getDb, sql } from "./db";

// Same firewall-self-traffic exclusion as the Overview page's Top 10 Most Active Devices
// (src/app/dashboard/page.tsx's TOP_DEVICES_EXCLUDED_IPS) - kept as a separate constant here
// rather than importing from a page module, but must stay in sync if that list changes.
const EXCLUDED_IPS = ["192.168.1.7"];

// The MikroTik's own two interface addresses (confirmed live via "/ip address print":
// 192.168.20.1 on internet_port/LAN, 10.20.20.2 on ether1/WAN) - a flow touching either one
// is a client managing the router itself (Winbox/webfig/SSH) or the router's own outbound
// traffic (NTP, firmware checks), not a client's real internet consumption, so these flows
// are excluded from Top Router Clients entirely rather than counted toward whichever client
// was on the other end.
const ROUTER_MANAGEMENT_IPS = ["192.168.20.1", "10.20.20.2"];

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

// Resolves a Sophos-side IP (192.168.1.x) to a staff name via SophosClients' MAC-address join -
// same reasoning and same query shape as the Overview page's topDevices resolution: WebFilterLogs'
// SrcIp values live in the Sophos address space, which the generic Staff.currentIp (populated by
// whichever poller - MikroTik or Sophos - last saw that staff member) can't be trusted to match.
async function getIpToStaffNameMap(): Promise<Map<string, string>> {
  const db = await getDb();
  const result = await db.query<{ IpAddress: string; Name: string }>(`
    SELECT sc.IpAddress, s.Name FROM SophosClients sc
    JOIN Staff s ON UPPER(s.MacAddress) = UPPER(sc.MacAddress)
    WHERE sc.MacAddress IS NOT NULL
  `);
  return new Map(result.recordset.map((r) => [r.IpAddress, r.Name]));
}

export async function getTopIps(hours: number, limit: number): Promise<TopIpRow[]> {
  const db = await getDb();
  const [result, nameByIp] = await Promise.all([
    db
      .request()
      .input("hours", sql.Int, hours)
      .query<{ SrcIp: string; TotalBytes: number; Requests: number }>(`
        SELECT TOP ${limit} SrcIp,
          SUM(ISNULL(BytesSent, 0) + ISNULL(BytesReceived, 0)) AS TotalBytes,
          COUNT(*) AS Requests
        FROM WebFilterLogs
        WHERE ReceivedAt >= DATEADD(HOUR, -@hours, SYSUTCDATETIME()) AND SrcIp IS NOT NULL
          AND SrcIp NOT IN (${EXCLUDED_IPS.map((ip) => `'${ip}'`).join(", ")})
        GROUP BY SrcIp
        ORDER BY TotalBytes DESC
      `),
    getIpToStaffNameMap(),
  ]);
  // mssql returns BIGINT columns (TotalBytes, from SUM over a BIGINT column) as a JS string,
  // not a number, to avoid silent precision loss above Number.MAX_SAFE_INTEGER - explicit
  // Number(...) here so callers get a real number rather than a string that happens to work by
  // luck in relational comparisons but breaks the moment anything does arithmetic on it.
  return result.recordset.map((r) => ({ ip: r.SrcIp, name: nameByIp.get(r.SrcIp) ?? null, totalBytes: Number(r.TotalBytes), requests: r.Requests }));
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
async function getIpToStaffNameMapViaRouter(): Promise<Map<string, string>> {
  const db = await getDb();
  const result = await db.query<{ IpAddress: string; Name: string }>(`
    SELECT rc.IpAddress, s.Name FROM RouterClients rc
    JOIN Staff s ON UPPER(s.MacAddress) = UPPER(rc.MacAddress)
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
// ROUTER_MANAGEMENT_IPS are excluded entirely (not counted toward the client on the other
// end) - a client configuring the router isn't "consuming bandwidth" in the sense this
// ranking is trying to measure.
export async function getTopRouterClients(hours: number, limit: number): Promise<TopRouterClientRow[]> {
  const db = await getDb();
  const managementIpList = ROUTER_MANAGEMENT_IPS.map((ip) => `'${ip}'`).join(", ");
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
