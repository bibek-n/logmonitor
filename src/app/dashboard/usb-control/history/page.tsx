import Link from "next/link";
import { getDb, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface HistoryRow {
  Id: number;
  DeviceId: string;
  HostName: string | null;
  Hostname: string;
  EventType: "insert" | "removal";
  UsbName: string | null;
  VendorId: string | null;
  VendorName: string | null;
  SerialNumber: string | null;
  StorageCapacityGB: number | null;
  DetectedAt: string;
}

export default async function UsbHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();

  const countResult = await db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM DeviceUsbEvents");
  const total = countResult.recordset[0].Total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rowsResult = await db
    .request()
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, PAGE_SIZE)
    .query<HistoryRow>(`
      SELECT e.Id, e.DeviceId, d.DeviceName AS HostName, d.Hostname, e.EventType, e.DeviceName AS UsbName, e.VendorId,
        e.VendorName, e.SerialNumber, e.StorageCapacityGB, CONVERT(VARCHAR(19), e.DetectedAt, 126) AS DetectedAt
      FROM DeviceUsbEvents e
      JOIN Devices d ON d.DeviceId = e.DeviceId
      ORDER BY e.DetectedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  const rows = rowsResult.recordset;

  const pageHref = (p: number) => `/dashboard/usb-control/history?page=${p}`;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>History</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Every USB insert/removal event detected across all monitored endpoints.
      </p>

      <div className="dash-panel">
        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No USB events recorded yet.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>Device</th>
                    <th style={{ padding: "0.4rem" }}>Event</th>
                    <th style={{ padding: "0.4rem" }}>USB Device</th>
                    <th style={{ padding: "0.4rem" }}>Vendor</th>
                    <th style={{ padding: "0.4rem" }}>Serial Number</th>
                    <th style={{ padding: "0.4rem" }}>Capacity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.DetectedAt).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/endpoint-agents/${r.DeviceId}`} style={{ color: "var(--series-1)" }}>
                          {r.HostName ?? r.Hostname}
                        </Link>
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        <span style={{ color: r.EventType === "insert" ? "var(--success)" : "var(--ink-muted)" }}>
                          {r.EventType === "insert" ? "Inserted" : "Removed"}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem" }}>{r.UsbName ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>
                        {r.VendorName ?? "-"}
                        {r.VendorId && <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}> ({r.VendorId})</span>}
                      </td>
                      <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{r.SerialNumber ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.StorageCapacityGB ? `${Math.round(r.StorageCapacityGB)} GB` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", fontSize: "0.85rem" }}>
              <span>
                Page {page} of {totalPages}
              </span>
              <span>
                {page > 1 && (
                  <Link href={pageHref(page - 1)} style={{ color: "var(--series-1)", marginRight: "1rem" }}>
                    &larr; Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={pageHref(page + 1)} style={{ color: "var(--series-1)" }}>
                    Next &rarr;
                  </Link>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
