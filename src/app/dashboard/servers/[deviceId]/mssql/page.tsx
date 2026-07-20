import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Badge } from "@/components/ui/Badge";
import { ServerDetailTabs } from "@/components/servers/ServerDetailTabs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const SEVERITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  critical: "danger",
  error: "danger",
  warning: "warning",
  info: "neutral",
};

interface LogRow {
  Id: number;
  ReceivedAt: string;
  LogTimestamp: string | null;
  LogSource: string;
  Severity: string | null;
  Message: string | null;
}

export default async function ServerMssqlPage({
  params,
  searchParams,
}: {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<{ page?: string; view?: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Server MSSQL Log</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view server logs.</p>
      </div>
    );
  }

  const { deviceId } = await params;
  const { page: pageParam, view } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();
  const deviceResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<{ DeviceName: string | null; Hostname: string }>(
    "SELECT DeviceName, Hostname FROM Devices WHERE DeviceId = @deviceId AND DeviceType = 'Server'"
  );
  const device = deviceResult.recordset[0];
  if (!device) notFound();

  // "slow" shows only the I/O-latency warnings SQL Server itself flags (LogSource
  // 'mssql_slow' - see agent/mssqllog.go's mssqlSlowPattern); "all" (default) shows the full
  // error log including those same rows, so switching views never hides data, just narrows it.
  const slowOnly = view === "slow";
  const sourceFilter = slowOnly ? ["mssql_slow"] : ["mssql", "mssql_slow"];

  const totalResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<{ Total: number }>(
    "SELECT COUNT(*) AS Total FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN ('mssql', 'mssql_slow')"
  );
  const mssqlLogCount = totalResult.recordset[0].Total;

  const slowCountResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<{ Total: number }>(
    "SELECT COUNT(*) AS Total FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource = 'mssql_slow'"
  );
  const slowCount = slowCountResult.recordset[0].Total;

  const filteredCountResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("source1", sql.VarChar, sourceFilter[0])
    .input("source2", sql.VarChar, sourceFilter[sourceFilter.length - 1])
    .query<{ Total: number }>("SELECT COUNT(*) AS Total FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN (@source1, @source2)");
  const filteredTotal = filteredCountResult.recordset[0].Total;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));

  const rowsResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("source1", sql.VarChar, sourceFilter[0])
    .input("source2", sql.VarChar, sourceFilter[sourceFilter.length - 1])
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, PAGE_SIZE)
    .query<LogRow>(`
      SELECT Id, CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt, CONVERT(VARCHAR(19), LogTimestamp, 126) AS LogTimestamp,
        LogSource, Severity, Message
      FROM ServerLogEntries
      WHERE DeviceId = @deviceId AND LogSource IN (@source1, @source2)
      ORDER BY ReceivedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

  const baseHref = `/dashboard/servers/${deviceId}/mssql`;
  const pageHref = (p: number, v: string | null) => {
    const params = new URLSearchParams();
    if (v) params.set("view", v);
    params.set("page", String(p));
    return `${baseHref}?${params.toString()}`;
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>
        MSSQL Log — {device.DeviceName ?? device.Hostname}
      </h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "0.75rem" }}>
        Tailed directly from this server&apos;s SQL Server ERRORLOG file. {slowCount} slow I/O warning(s) of {mssqlLogCount} total entries.
      </p>

      <ServerDetailTabs deviceId={deviceId} active="mssql" logCount={0} mssqlLogCount={mssqlLogCount} />

      <div className="flex flex-wrap gap-2 mb-4" style={{ fontSize: "0.8rem" }}>
        <Link
          href={baseHref}
          style={{
            padding: "0.3rem 0.7rem",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: !slowOnly ? "var(--primary)" : "var(--surface-2)",
            color: !slowOnly ? "#fff" : "var(--ink)",
          }}
        >
          All ({mssqlLogCount})
        </Link>
        <Link
          href={`${baseHref}?view=slow`}
          style={{
            padding: "0.3rem 0.7rem",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: slowOnly ? "var(--primary)" : "var(--surface-2)",
            color: slowOnly ? "#fff" : "var(--ink)",
          }}
        >
          Slow / I-O Warnings ({slowCount})
        </Link>
      </div>

      <div className="dash-panel">
        {rowsResult.recordset.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            {mssqlLogCount === 0
              ? "No MSSQL log data synced yet — the agent only ships this once it detects a live SQL Server ERRORLOG file on this box."
              : "No entries match this filter."}
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>Type</th>
                    <th style={{ padding: "0.4rem" }}>Severity</th>
                    <th style={{ padding: "0.4rem" }}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsResult.recordset.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{r.LogTimestamp ?? r.ReceivedAt}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <Badge tone="neutral">{r.LogSource === "mssql_slow" ? "Slow I/O" : "Error Log"}</Badge>
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        {r.Severity ? <Badge tone={SEVERITY_TONE[r.Severity.toLowerCase()] ?? "neutral"}>{r.Severity}</Badge> : "—"}
                      </td>
                      <td style={{ padding: "0.4rem" }}>{r.Message ?? "—"}</td>
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
                  <Link href={pageHref(page - 1, slowOnly ? "slow" : null)} style={{ color: "var(--series-1)", marginRight: "1rem" }}>
                    &larr; Prev
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={pageHref(page + 1, slowOnly ? "slow" : null)} style={{ color: "var(--series-1)" }}>
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
