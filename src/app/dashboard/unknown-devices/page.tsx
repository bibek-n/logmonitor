import { getDb } from "@/lib/db";
import { classifyDevice } from "@/lib/deviceType";

export const dynamic = "force-dynamic";

interface UnknownDeviceRow {
  MacAddress: string;
  Hostname: string | null;
  LastSeen: string | null;
  Sources: string;
  VendorName: string | null;
}

function isRecentlyPolled(lastSeen: string | null, staleMinutes = 10): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() <= staleMinutes * 60 * 1000;
}

// "Unknown" = a MAC address this app has actually observed (MikroTik DHCP lease, Sophos ARP
// table, or our own endpoint agent) that has no Staff match at all - neither via Staff's own
// MacAddress field (how RouterClients/SophosClients get tied to a person, see staffStatus.ts)
// nor via a direct-enrollment Devices.StaffId link. Every known-staff device is deliberately
// excluded here rather than just hidden client-side, since the whole point of this page is a
// short, actionable list of devices nobody has accounted for.
async function getUnknownDevices() {
  const db = await getDb();

  const result = await db.query<UnknownDeviceRow>(`
    WITH AllMacs AS (
      SELECT MacAddress, Hostname, 'MikroTik' AS Source, UpdatedAt AS LastSeen FROM RouterClients
        WHERE MacAddress IS NOT NULL AND MacAddress <> ''
      UNION ALL
      SELECT MacAddress, Hostname, 'Sophos' AS Source, UpdatedAt AS LastSeen FROM SophosClients
        WHERE MacAddress IS NOT NULL AND MacAddress <> ''
      UNION ALL
      SELECT MacAddress, Hostname, 'Agent' AS Source, LastHeartbeat AS LastSeen FROM Devices
        WHERE MacAddress IS NOT NULL AND MacAddress <> ''
    ),
    Best AS (
      SELECT MacAddress, Hostname, LastSeen,
        ROW_NUMBER() OVER (PARTITION BY MacAddress ORDER BY LastSeen DESC) AS rn
      FROM AllMacs
    ),
    Sources AS (
      SELECT MacAddress, STRING_AGG(Source, ', ') WITHIN GROUP (ORDER BY Source) AS Sources
      FROM (SELECT DISTINCT MacAddress, Source FROM AllMacs) x
      GROUP BY MacAddress
    )
    SELECT b.MacAddress, b.Hostname, b.LastSeen, s.Sources, ov.VendorName
    FROM Best b
    JOIN Sources s ON s.MacAddress = b.MacAddress
    LEFT JOIN OuiVendors ov ON ov.Prefix = REPLACE(LEFT(b.MacAddress, 8), ':', '')
    WHERE b.rn = 1
      AND NOT EXISTS (SELECT 1 FROM Staff st WHERE st.MacAddress = b.MacAddress)
      AND NOT EXISTS (SELECT 1 FROM Devices d WHERE d.MacAddress = b.MacAddress AND d.StaffId IS NOT NULL)
    ORDER BY b.LastSeen DESC
  `);

  const totalResult = await db.query<{ TotalMacs: number }>(`
    SELECT COUNT(DISTINCT MacAddress) AS TotalMacs FROM (
      SELECT MacAddress FROM RouterClients WHERE MacAddress IS NOT NULL AND MacAddress <> ''
      UNION
      SELECT MacAddress FROM SophosClients WHERE MacAddress IS NOT NULL AND MacAddress <> ''
      UNION
      SELECT MacAddress FROM Devices WHERE MacAddress IS NOT NULL AND MacAddress <> ''
    ) x
  `);

  return { unknown: result.recordset, totalMacs: totalResult.recordset[0]?.TotalMacs ?? 0 };
}

function StatTile({ label, value, status }: { label: string; value: number; status: "good" | "warning" | "unknown" }) {
  return (
    <div className={`stat-tile status-${status}`}>
      <span className={`status-dot status-${status}`} style={{ marginRight: "0.4rem" }} />
      <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>{label}</div>
    </div>
  );
}

export default async function UnknownDevicesPage() {
  const { unknown, totalMacs } = await getUnknownDevices();

  return (
    <div>
      <h1>Unknown Devices</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Every MAC address ever seen on the network (MikroTik, Sophos, or our own agent) that
        isn&apos;t matched to a staff member &mdash; {unknown.length} of {totalMacs} known devices.
      </p>

      <div className="stat-grid">
        <StatTile label="Total devices seen" value={totalMacs} status="good" />
        <StatTile label="Unknown devices" value={unknown.length} status={unknown.length > 0 ? "warning" : "good"} />
        <StatTile label="Mapped to staff" value={totalMacs - unknown.length} status="good" />
      </div>

      <div className="dash-panel">
        {unknown.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            Every device this app has seen on the network is mapped to a staff member. Nothing
            unaccounted for right now.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Hostname</th>
                <th style={{ padding: "0.5rem" }}>Device Type</th>
                <th style={{ padding: "0.5rem" }}>Vendor</th>
                <th style={{ padding: "0.5rem" }}>MAC Address</th>
                <th style={{ padding: "0.5rem" }}>Seen Via</th>
                <th style={{ padding: "0.5rem" }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {unknown.map((d) => {
                const fresh = isRecentlyPolled(d.LastSeen);
                const deviceType = classifyDevice(d.Hostname, d.VendorName);
                return (
                  <tr key={d.MacAddress} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <span className={`status-dot status-${fresh ? "warning" : "unknown"}`} style={{ marginRight: "0.4rem" }} />
                      {d.Hostname && d.Hostname.toLowerCase() !== "unknown" ? d.Hostname : "-"}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{deviceType}</td>
                    <td style={{ padding: "0.5rem" }}>{d.VendorName ?? "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{d.MacAddress}</td>
                    <td style={{ padding: "0.5rem" }}>{d.Sources}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {d.LastSeen ? new Date(d.LastSeen).toLocaleString() : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
