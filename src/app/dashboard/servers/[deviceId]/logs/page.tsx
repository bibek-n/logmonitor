import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Badge } from "@/components/ui/Badge";
import { ServerDetailTabs } from "@/components/servers/ServerDetailTabs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const SOURCE_LABELS: Record<string, string> = {
  apache_access: "Apache Access",
  apache_error: "Apache Error",
  nginx_access: "Nginx Access",
  nginx_error: "Nginx Error",
  mysql: "MySQL",
  php: "PHP",
  system: "System",
  eventlog: "Event Viewer",
  reboot: "Reboot Events",
};

const SEVERITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  error: "danger",
  critical: "danger",
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
  SiteName: string | null;
}

export default async function ServerLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<{ page?: string; source?: string; site?: string }>;
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
  const { page: pageParam, source, site } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();
  const deviceResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<{ DeviceName: string | null; Hostname: string }>(
    "SELECT DeviceName, Hostname FROM Devices WHERE DeviceId = @deviceId AND DeviceType = 'Server'"
  );
  const device = deviceResult.recordset[0];
  if (!device) notFound();

  const sourceFilter = source && SOURCE_LABELS[source] ? source : null;
  const siteFilter = site && site.trim() ? site.trim() : null;

  const conditions = ["DeviceId = @deviceId"];
  if (sourceFilter) conditions.push("LogSource = @source");
  if (siteFilter) conditions.push("SiteName = @site");
  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  function bindFilters<T>(request: T & { input: (name: string, type: unknown, value: unknown) => T }): T {
    if (sourceFilter) request.input("source", sql.VarChar, sourceFilter);
    if (siteFilter) request.input("site", sql.NVarChar, siteFilter);
    return request;
  }

  const countResult = await bindFilters(db.request().input("deviceId", sql.VarChar, deviceId)).query<{ Total: number }>(
    `SELECT COUNT(*) AS Total FROM ServerLogEntries ${whereClause}`
  );
  const total = countResult.recordset[0].Total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Unfiltered count, so the "Logs" tab always shows the same total as the Overview tab
  // regardless of which source/site filter is currently applied on this page.
  const unfilteredTotalResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<{ Total: number }>(
    "SELECT COUNT(*) AS Total FROM ServerLogEntries WHERE DeviceId = @deviceId"
  );
  const unfilteredTotal = unfilteredTotalResult.recordset[0].Total;

  const rowsResult = await bindFilters(
    db.request().input("deviceId", sql.VarChar, deviceId).input("offset", sql.Int, offset).input("limit", sql.Int, PAGE_SIZE)
  ).query<LogRow>(`
    SELECT Id, CONVERT(VARCHAR(19), ReceivedAt, 126) AS ReceivedAt, CONVERT(VARCHAR(19), LogTimestamp, 126) AS LogTimestamp,
      LogSource, Severity, Message, SiteName
    FROM ServerLogEntries
    ${whereClause}
    ORDER BY ReceivedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  // Distinct vhost names seen for this device, for the Site filter dropdown - only ever
  // populated by nginx_access/nginx_error entries (see agent/logs.go's per-vhost discovery),
  // null/absent for every other source.
  const sitesResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<{ SiteName: string }>(
    "SELECT DISTINCT SiteName FROM ServerLogEntries WHERE DeviceId = @deviceId AND SiteName IS NOT NULL ORDER BY SiteName ASC"
  );

  const baseHref = `/dashboard/servers/${deviceId}/logs`;
  // Switching the Source pill keeps whatever Site filter is set (a vhost name is meaningful
  // regardless of whether "Nginx Access" or "Nginx Error" is selected); the Site dropdown's own
  // form (below) is the only place that changes `site`.
  const withSource = (s: string | null) => {
    const params = new URLSearchParams();
    if (s) params.set("source", s);
    if (siteFilter) params.set("site", siteFilter);
    const qs = params.toString();
    return qs ? `${baseHref}?${qs}` : baseHref;
  };
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (sourceFilter) params.set("source", sourceFilter);
    if (siteFilter) params.set("site", siteFilter);
    params.set("page", String(p));
    return `${baseHref}?${params.toString()}`;
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>
        Logs — {device.DeviceName ?? device.Hostname}
      </h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "0.75rem" }}>
        {total} {total === unfilteredTotal ? "total" : `of ${unfilteredTotal}`} entries
      </p>

      <ServerDetailTabs deviceId={deviceId} active="logs" logCount={unfilteredTotal} />

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

      {sitesResult.recordset.length > 0 && (
        <form method="GET" action={baseHref} className="flex items-center gap-2 mb-4" style={{ fontSize: "0.82rem" }}>
          {sourceFilter && <input type="hidden" name="source" value={sourceFilter} />}
          <label htmlFor="site-filter" style={{ color: "var(--ink-muted)" }}>
            Virtual host (nginx)
          </label>
          <select
            id="site-filter"
            name="site"
            defaultValue={siteFilter ?? ""}
            style={{ padding: "0.3rem 0.5rem", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)" }}
          >
            <option value="">All sites</option>
            {sitesResult.recordset.map((s) => (
              <option key={s.SiteName} value={s.SiteName}>
                {s.SiteName}
              </option>
            ))}
          </select>
          <button type="submit" className="submit" style={{ width: "auto", marginTop: 0, padding: "0.3rem 0.8rem" }}>
            Filter
          </button>
          {siteFilter && (
            <Link href={withSource(sourceFilter)} style={{ color: "var(--danger)" }}>
              Clear site filter
            </Link>
          )}
        </form>
      )}

      <div className="dash-panel">
        {rowsResult.recordset.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No log entries yet — the agent ships new lines from Apache/Nginx/PHP/MySQL/system logs as they're detected.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>Source</th>
                    <th style={{ padding: "0.4rem" }}>Site</th>
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
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{r.SiteName ?? "—"}</td>
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
                  <Link href={pageHref(page - 1)} style={{ color: "var(--series-1)", marginRight: "1rem" }}>
                    &larr; Prev
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
