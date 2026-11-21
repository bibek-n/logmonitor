import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface HostRow {
  SrcIp: string;
  SrcMac: string | null;
  LastDomain: string | null;
  Total: number;
  LastSeen: string;
}

export default async function RouterWebIndexPage() {
  const db = await getDb();
  const result = await db.query<HostRow>(`
    SELECT SrcIp,
      (SELECT TOP 1 SrcMac FROM RouterWebLogs r2 WHERE r2.SrcIp = r1.SrcIp AND SrcMac IS NOT NULL ORDER BY ReceivedAt DESC) AS SrcMac,
      (SELECT TOP 1 ReverseDns FROM RouterWebLogs r3 WHERE r3.SrcIp = r1.SrcIp AND ReverseDns IS NOT NULL ORDER BY ReceivedAt DESC) AS LastDomain,
      COUNT(*) AS Total,
      MAX(ReceivedAt) AS LastSeen
    FROM RouterWebLogs r1
    WHERE SrcIp IS NOT NULL
    GROUP BY SrcIp
    ORDER BY SrcIp
  `);

  const hosts = result.recordset;

  // Same reasoning as router-clients/page.tsx: derived from the actual data rather than a
  // hardcoded subnet, so this reads correctly for any company's own MikroTik network.
  const subnetCounts = new Map<string, number>();
  for (const h of hosts) {
    const prefix = h.SrcIp.split(".").slice(0, 3).join(".");
    subnetCounts.set(prefix, (subnetCounts.get(prefix) ?? 0) + 1);
  }
  const commonSubnet = [...subnetCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return (
    <div>
      <h1>Router Web Connections — Internal IPs</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        MikroTik Router{commonSubnet ? ` · ${commonSubnet}.0/24 client network` : ""}
      </p>

      <div className="dash-panel">
        {hosts.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No router web connections received yet. Waiting for MikroTik syslog data on port 5515.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Internal IP</th>
                <th style={{ padding: "0.5rem" }}>MAC Address</th>
                <th style={{ padding: "0.5rem" }}>Last Domain</th>
                <th style={{ padding: "0.5rem" }}>Connections</th>
                <th style={{ padding: "0.5rem" }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((h) => (
                <tr key={h.SrcIp} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <Link href={`/dashboard/router-web/${encodeURIComponent(h.SrcIp)}`} style={{ color: "var(--series-1)" }}>
                      {h.SrcIp}
                    </Link>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{h.SrcMac ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{h.LastDomain ?? "-"}</td>
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
