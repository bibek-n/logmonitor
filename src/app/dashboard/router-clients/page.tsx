import { getDb, sql } from "@/lib/db";
import BandwidthChart from "@/components/BandwidthChart";
import { classifyDevice } from "@/lib/deviceType";

export const dynamic = "force-dynamic";

interface ClientRow {
  IpAddress: string;
  MacAddress: string | null;
  Hostname: string | null;
  Status: string | null;
  LastSeenRaw: string | null;
  UpdatedAt: string;
  VendorName: string | null;
}

interface BandwidthRow {
  ReceivedAt: string;
  RxMbps: number | null;
  TxMbps: number | null;
}

function isRecentlyPolled(updatedAt: string, staleMinutes = 10): boolean {
  return Date.now() - new Date(updatedAt).getTime() <= staleMinutes * 60 * 1000;
}

async function bandwidthPoints(iface: string) {
  const db = await getDb();
  const result = await db
    .request()
    .input("iface", sql.NVarChar, iface)
    .query<BandwidthRow>(`
      SELECT TOP 50 ReceivedAt, RxMbps, TxMbps
      FROM RouterBandwidth
      WHERE Interface = @iface
      ORDER BY ReceivedAt DESC
    `);
  return result.recordset
    .filter((r) => r.RxMbps !== null && r.TxMbps !== null)
    .map((r) => ({ t: r.ReceivedAt, rx: Number(r.RxMbps), tx: Number(r.TxMbps) }))
    .reverse();
}

export default async function RouterClientsPage() {
  const db = await getDb();
  const result = await db.query<ClientRow>(`
    SELECT rc.IpAddress, rc.MacAddress, rc.Hostname, rc.Status, rc.LastSeenRaw, rc.UpdatedAt, ov.VendorName
    FROM RouterClients rc
    LEFT JOIN OuiVendors ov ON ov.Prefix = REPLACE(LEFT(rc.MacAddress, 8), ':', '')
    ORDER BY
      CAST(PARSENAME(rc.IpAddress, 1) AS INT),
      CAST(PARSENAME(rc.IpAddress, 2) AS INT),
      CAST(PARSENAME(rc.IpAddress, 3) AS INT),
      CAST(PARSENAME(rc.IpAddress, 4) AS INT)
  `);

  const clients = result.recordset;
  const [uplinkPoints, lanPoints] = await Promise.all([
    bandwidthPoints("ether1"),
    bandwidthPoints("internet_port"),
  ]);

  return (
    <div>
      <h1>Router Clients</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        MikroTik 10.20.20.2 &middot; DHCP leases on 192.168.20.0/24 &middot; {clients.length} known devices
      </p>

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>
          Uplink Bandwidth (ether1 &rarr; Sophos)
        </h2>
        <BandwidthChart points={uplinkPoints} unit="Mbps" />
      </div>

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>
          LAN Bandwidth (internet_port &rarr; clients)
        </h2>
        <BandwidthChart points={lanPoints} unit="Mbps" />
      </div>

      <div className="dash-panel">
        {clients.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No client data yet. Waiting for the first DHCP lease poll from the router.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>IP Address</th>
                <th style={{ padding: "0.5rem" }}>Hostname</th>
                <th style={{ padding: "0.5rem" }}>Device Type</th>
                <th style={{ padding: "0.5rem" }}>MAC Address</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const fresh = isRecentlyPolled(c.UpdatedAt);
                const status = !fresh ? "unknown" : c.Status === "bound" ? "good" : "warning";
                const deviceType = classifyDevice(c.Hostname, c.VendorName);
                return (
                  <tr key={c.IpAddress} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <span className={`status-dot status-${status}`} style={{ marginRight: "0.4rem" }} />
                      {c.IpAddress}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{c.Hostname ?? "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{deviceType}</td>
                    <td style={{ padding: "0.5rem" }}>{c.MacAddress ?? "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{c.Status ?? "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{c.LastSeenRaw ?? "-"} ago</td>
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
