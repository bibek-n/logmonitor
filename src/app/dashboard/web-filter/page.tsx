import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface HostRow {
  SrcIp: string;
  Total: number;
  LastSeen: string;
}

export default async function WebFilterIndexPage() {
  const db = await getDb();
  const result = await db.query<HostRow>(`
    SELECT SrcIp, COUNT(*) AS Total, MAX(ReceivedAt) AS LastSeen
    FROM WebFilterLogs
    WHERE SrcIp IS NOT NULL
    GROUP BY SrcIp
    ORDER BY SrcIp
  `);

  const hosts = result.recordset;

  return (
    <div>
      <h1>Sophos Web Filter — Internal IPs</h1>

      <div className="dash-panel">
        {hosts.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No web filter events received yet. Waiting for Sophos syslog data on port 5514.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Internal IP</th>
                <th style={{ padding: "0.5rem" }}>Events</th>
                <th style={{ padding: "0.5rem" }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr key={h.SrcIp} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <Link href={`/dashboard/web-filter/${encodeURIComponent(h.SrcIp)}`} style={{ color: "var(--series-1)" }}>
                      {h.SrcIp}
                    </Link>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{h.Total}</td>
                  <td style={{ padding: "0.5rem" }}>{new Date(h.LastSeen).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
