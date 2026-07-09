import Link from "next/link";
import { getDb, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface LogRow {
  Id: number;
  ReceivedAt: string;
  DstIp: string | null;
  DstPort: number | null;
  Protocol: string | null;
  ReverseDns: string | null;
}

export default async function RouterWebHostPage({
  params,
  searchParams,
}: {
  params: Promise<{ ip: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { ip: ipParam } = await params;
  const { page: pageParam } = await searchParams;
  const ip = decodeURIComponent(ipParam);
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();

  const countResult = await db
    .request()
    .input("ip", sql.VarChar, ip)
    .query("SELECT COUNT(*) AS Total FROM RouterWebLogs WHERE SrcIp = @ip");
  const total = countResult.recordset[0].Total as number;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rowsResult = await db
    .request()
    .input("ip", sql.VarChar, ip)
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, PAGE_SIZE)
    .query<LogRow>(`
      SELECT Id, ReceivedAt, DstIp, DstPort, Protocol, ReverseDns
      FROM RouterWebLogs
      WHERE SrcIp = @ip
      ORDER BY ReceivedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  const rows = rowsResult.recordset;

  return (
    <div>
      <h1>{ip}</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        <Link href="/dashboard/router-web" style={{ color: "var(--series-1)" }}>
          &larr; All IPs
        </Link>
        {"  ·  "}
        {total} total connections
      </p>

      <div className="dash-panel">
        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No connections for this IP yet.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>Destination</th>
                    <th style={{ padding: "0.4rem" }}>Port</th>
                    <th style={{ padding: "0.4rem" }}>Protocol</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                        {new Date(r.ReceivedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        {r.ReverseDns ?? r.DstIp ?? "-"}
                        {r.ReverseDns && (
                          <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}> ({r.DstIp})</span>
                        )}
                      </td>
                      <td style={{ padding: "0.4rem" }}>{r.DstPort ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Protocol ?? "-"}</td>
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
                  <Link href={`/dashboard/router-web/${encodeURIComponent(ip)}?page=${page - 1}`} style={{ color: "var(--series-1)", marginRight: "1rem" }}>
                    &larr; Prev
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/dashboard/router-web/${encodeURIComponent(ip)}?page=${page + 1}`} style={{ color: "var(--series-1)" }}>
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
