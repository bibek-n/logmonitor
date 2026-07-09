import Link from "next/link";
import { getDb } from "@/lib/db";
import { classifyDevice } from "@/lib/deviceType";

export const dynamic = "force-dynamic";

interface ClientRow {
  IpAddress: string;
  FirstSeen: string | null;
  LastSeen: string | null;
  EventCount: number;
  MacAddress: string | null;
  Hostname: string | null;
  SnmpUpdatedAt: string | null;
  VendorName: string | null;
}

function isRecent(timestamp: string | null, staleMinutes = 10): boolean {
  if (!timestamp) return false;
  return Date.now() - new Date(timestamp).getTime() <= staleMinutes * 60 * 1000;
}

function StatTile({ label, value, status }: { label: string; value: string | number; status: string }) {
  return (
    <div className={`stat-tile status-${status}`}>
      <div className="label">
        <span className={`status-dot status-${status}`} />
        {label}
      </div>
      <div className="value">{value}</div>
    </div>
  );
}

export default async function SophosClientsPage() {
  const db = await getDb();
  const result = await db.query<ClientRow>(`
    SELECT
      COALESCE(w.SrcIp, sc.IpAddress) AS IpAddress,
      w.FirstSeen, w.LastSeen, ISNULL(w.EventCount, 0) AS EventCount,
      sc.MacAddress, sc.Hostname, sc.UpdatedAt AS SnmpUpdatedAt, ov.VendorName
    FROM (
      SELECT SrcIp, MIN(ReceivedAt) AS FirstSeen, MAX(ReceivedAt) AS LastSeen, COUNT(*) AS EventCount
      FROM WebFilterLogs WHERE SrcIp IS NOT NULL GROUP BY SrcIp
    ) w
    FULL OUTER JOIN SophosClients sc ON sc.IpAddress = w.SrcIp
    LEFT JOIN OuiVendors ov ON ov.Prefix = REPLACE(LEFT(sc.MacAddress, 8), ':', '')
    ORDER BY
      CAST(PARSENAME(COALESCE(w.SrcIp, sc.IpAddress), 1) AS INT),
      CAST(PARSENAME(COALESCE(w.SrcIp, sc.IpAddress), 2) AS INT),
      CAST(PARSENAME(COALESCE(w.SrcIp, sc.IpAddress), 3) AS INT),
      CAST(PARSENAME(COALESCE(w.SrcIp, sc.IpAddress), 4) AS INT)
  `);

  const clients = result.recordset.map((c) => ({
    ...c,
    active: isRecent(c.LastSeen) || isRecent(c.SnmpUpdatedAt),
  }));

  const online = clients.filter((c) => c.active).length;
  const offline = clients.length - online;
  const withMac = clients.filter((c) => c.MacAddress).length;
  const withHostname = clients.filter((c) => c.Hostname).length;

  return (
    <div>
      <h1>Sophos Clients</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Combines every device seen either browsing (Web Filter logs) or present in the Sophos firewall&apos;s own
        SNMP ARP table — so devices show up here even before they&apos;ve generated any web traffic. Hostnames come
        from NetBIOS resolution (via this server, which shares the same LAN) — this works for Windows PCs but not
        phones or other devices that don&apos;t support NetBIOS, since Sophos itself doesn&apos;t expose DHCP
        hostnames through any interface we have access to.
      </p>

      <div className="stat-grid">
        <StatTile label="Total Clients" value={clients.length} status="unknown" />
        <StatTile label="Online" value={online} status={online > 0 ? "good" : "unknown"} />
        <StatTile label="Offline" value={offline} status={offline > 0 ? "warning" : "good"} />
        <StatTile label="MAC Resolved" value={`${withMac} / ${clients.length}`} status={withMac > 0 ? "good" : "unknown"} />
        <StatTile label="Hostname Resolved" value={`${withHostname} / ${clients.length}`} status={withHostname > 0 ? "good" : "unknown"} />
      </div>

      <div className="dash-panel">
        {clients.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No Sophos client activity yet. Waiting for Web Filter syslog data or the next SNMP poll.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>IP Address</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Hostname</th>
                <th style={{ padding: "0.5rem" }}>Device Type</th>
                <th style={{ padding: "0.5rem" }}>MAC Address</th>
                <th style={{ padding: "0.5rem" }}>First Seen (Web)</th>
                <th style={{ padding: "0.5rem" }}>Last Seen (Web)</th>
                <th style={{ padding: "0.5rem" }}>Events</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.IpAddress} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <span className={`status-dot status-${c.active ? "good" : "warning"}`} style={{ marginRight: "0.4rem" }} />
                    <Link href={`/dashboard/web-filter/${encodeURIComponent(c.IpAddress)}`} style={{ color: "var(--series-1)" }}>
                      {c.IpAddress}
                    </Link>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{c.active ? "Online" : "Offline"}</td>
                  <td style={{ padding: "0.5rem" }}>{c.Hostname ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{classifyDevice(c.Hostname, c.VendorName)}</td>
                  <td style={{ padding: "0.5rem" }}>{c.MacAddress ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{c.FirstSeen ? new Date(c.FirstSeen).toLocaleString() : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{c.LastSeen ? new Date(c.LastSeen).toLocaleString() : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{c.EventCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
