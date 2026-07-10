import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const SOURCE_LABELS: Record<string, string> = {
  apache_access: "Apache Access",
  apache_error: "Apache Error",
  mysql: "MySQL",
  php: "PHP",
  system: "System",
};

const SEVERITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  error: "danger",
  crit: "danger",
  emerg: "danger",
  alert: "danger",
  warning: "warning",
  warn: "warning",
};

interface LogRow {
  Id: number;
  ReceivedAt: string;
  LogTimestamp: string | null;
  LogSource: string;
  Severity: string | null;
  Message: string | null;
}

export default async function ServerLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<{ page?: string; source?: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Server Logs</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view server logs.</p>
      </div>
    );
  }

  const { deviceId } = await params;
  const { page: pageParam, source } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();
  const deviceResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<{ DeviceName: string | null; Hostname: string }>(
    "SELECT DeviceName, Hostname FROM Devices WHERE DeviceId = @deviceId AND DeviceType = 'Server'"
  );
  const device = deviceResult.recordset[0];
  if (!device) notFound();

  const sourceFilter = source && SOURCE_LABELS[source] ? source : null;
  const whereClause = sourceFilter ? "WHERE DeviceId = @deviceId AND LogSource = @source" : "WHERE DeviceId = @deviceId";

  const countRequest = db.request().input("deviceId", sql.VarChar, deviceId);
  if (sourceFilter) countRequest.input("source", sql.VarChar, sourceFilter);
  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM ServerLogEntries ${whereClause}`);
  const total = countResult.recordset[0].Total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rowsRequest = db.request().input("deviceId", sql.VarChar, deviceId).input("offset", sql.Int, offset).input("limit", sql.Int, PAGE_SIZE);
  if (sourceFilter) rowsRequest.input("source", sql.VarChar, sourceFilter);
  const rowsResult = await rowsRequest.query<LogRow>(`
    SELECT Id, CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt, CONVERT(VARCHAR(19), LogTimestamp, 126) AS LogTimestamp,
      LogSource, Severity, Message
    FROM ServerLogEntries
    ${whereClause}
    ORDER BY ReceivedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const baseHref = `/dashboard/servers/${deviceId}/logs`;
  const withSource = (s: string | null) => (s ? `${baseHref}?source=${s}` : baseHref);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>
        Logs — {device.DeviceName ?? device.Hostname}
      </h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        {total} total entries ·{" "}
        <Link href={`/dashboard/servers/${deviceId}`} style={{ color: "var(--primary)" }}>
          Back to server
        </Link>
      </p>

      <div className="flex flex-wrap gap-2 mb-4" style={{ fontSize: "0.8rem" }}>
        <Link
          href={withSource(null)}
          style={{
            padding: "0.3rem 0.7rem",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: !sourceFilter ? "var(--primary)" : "var(--surface-2)",
            color: !sourceFilter ? "#fff" : "var(--ink)",
          }}
        >
          All
        </Link>
        {Object.entries(SOURCE_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={withSource(key)}
            style={{
              padding: "0.3rem 0.7rem",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: sourceFilter === key ? "var(--primary)" : "var(--surface-2)",
              color: sourceFilter === key ? "#fff" : "var(--ink)",
            }}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="dash-panel">
        {rowsResult.recordset.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No log entries yet — the agent ships new lines from Apache/PHP/MySQL/system logs as they're detected.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>Source</th>
                    <th style={{ padding: "0.4rem" }}>Severity</th>
                    <th style={{ padding: "0.4rem" }}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsResult.recordset.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{r.LogTimestamp ?? r.ReceivedAt}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <Badge tone="neutral">{SOURCE_LABELS[r.LogSource] ?? r.LogSource}</Badge>
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
                  <Link href={`${withSource(sourceFilter)}${sourceFilter ? "&" : "?"}page=${page - 1}`} style={{ color: "var(--series-1)", marginRight: "1rem" }}>
                    &larr; Prev
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`${withSource(sourceFilter)}${sourceFilter ? "&" : "?"}page=${page + 1}`} style={{ color: "var(--series-1)" }}>
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
