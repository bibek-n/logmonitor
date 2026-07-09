import { getDb, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

interface LogRow {
  Id: number;
  ReceivedAt: string;
  DeviceTimestamp: string | null;
  Hostname: string | null;
  Facility: string | null;
  Severity: string | null;
  Message: string | null;
}

const SEVERITY_STATUS: Record<string, string> = {
  emergency: "critical",
  alert: "critical",
  critical: "critical",
  error: "serious",
  warning: "warning",
  notice: "good",
  info: "good",
  debug: "good",
};

export default async function RouterLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();

  const countResult = await db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM RouterLogs");
  const total = countResult.recordset[0].Total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rowsResult = await db
    .request()
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, PAGE_SIZE)
    .query<LogRow>(`
      SELECT Id, ReceivedAt, DeviceTimestamp, Hostname, Facility, Severity, Message
      FROM RouterLogs
      ORDER BY ReceivedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  const rows = rowsResult.recordset;

  return (
    <div>
      <h1>MikroTik Router Logs</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        {total} total events &middot; 10.20.20.2
      </p>

      <div className="dash-panel">
        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No router events received yet. Waiting for MikroTik syslog data on port 5515.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>Severity</th>
                    <th style={{ padding: "0.4rem" }}>Facility</th>
                    <th style={{ padding: "0.4rem" }}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const status = SEVERITY_STATUS[r.Severity ?? ""] ?? "unknown";
                    return (
                      <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                        <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                          {new Date(r.DeviceTimestamp ?? r.ReceivedAt).toLocaleString()}
                        </td>
                        <td style={{ padding: "0.4rem" }}>
                          <span className={`status-dot status-${status}`} style={{ marginRight: "0.4rem" }} />
                          {r.Severity ?? "-"}
                        </td>
                        <td style={{ padding: "0.4rem" }}>{r.Facility ?? "-"}</td>
                        <td style={{ padding: "0.4rem" }}>{r.Message ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", fontSize: "0.85rem" }}>
              <span>
                Page {page} of {totalPages}
              </span>
              <span>
                {page > 1 && (
                  <a href={`/dashboard/router-logs?page=${page - 1}`} style={{ color: "var(--series-1)", marginRight: "1rem" }}>
                    &larr; Prev
                  </a>
                )}
                {page < totalPages && (
                  <a href={`/dashboard/router-logs?page=${page + 1}`} style={{ color: "var(--series-1)" }}>
                    Next &rarr;
                  </a>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
