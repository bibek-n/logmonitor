import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ConnectedRow {
  DeviceId: string;
  HostName: string | null;
  Hostname: string;
  UsbName: string | null;
  VendorId: string | null;
  VendorName: string | null;
  SerialNumber: string | null;
  StorageCapacityGB: number | null;
  DetectedAt: string;
}

// "Currently connected" is derived from the DeviceUsbEvents history, not a separate live-state
// table: the latest event per (DeviceId, VendorId, SerialNumber, DeviceName) identity, kept
// only if that latest event is an "insert" with no later "removal" for the same identity.
export default async function ConnectedUsbPage() {
  const db = await getDb();

  const result = await db.query<ConnectedRow>(`
    WITH Ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY DeviceId, ISNULL(VendorId, ''), ISNULL(SerialNumber, ''), ISNULL(DeviceName, '')
          ORDER BY DetectedAt DESC
        ) AS rn
      FROM DeviceUsbEvents
    )
    SELECT d.DeviceName AS HostName, d.Hostname, r.DeviceName AS UsbName, r.VendorId, r.VendorName, r.SerialNumber,
      r.StorageCapacityGB, CONVERT(VARCHAR(19), r.DetectedAt, 126) AS DetectedAt, d.DeviceId
    FROM Ranked r
    JOIN Devices d ON d.DeviceId = r.DeviceId
    WHERE r.rn = 1 AND r.EventType = 'insert'
    ORDER BY d.DeviceName ASC, r.DetectedAt DESC
  `);
  const rows = result.recordset;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Connected USB</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        USB devices currently plugged in across all monitored endpoints, based on the most recent insert/removal event seen
        for each device.
      </p>

      <div className="dash-panel">
        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No USB devices currently detected as connected.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Device</th>
                  <th style={{ padding: "0.4rem" }}>USB Device</th>
                  <th style={{ padding: "0.4rem" }}>Vendor</th>
                  <th style={{ padding: "0.4rem" }}>Serial Number</th>
                  <th style={{ padding: "0.4rem" }}>Capacity</th>
                  <th style={{ padding: "0.4rem" }}>Connected Since</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>
                      <Link href={`/dashboard/endpoint-agents/${r.DeviceId}`} style={{ color: "var(--series-1)" }}>
                        {r.HostName ?? r.Hostname}
                      </Link>
                    </td>
                    <td style={{ padding: "0.4rem" }}>{r.UsbName ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>
                      {r.VendorName ?? "-"}
                      {r.VendorId && <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}> ({r.VendorId})</span>}
                    </td>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{r.SerialNumber ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{r.StorageCapacityGB ? `${Math.round(r.StorageCapacityGB)} GB` : "-"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.DetectedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
