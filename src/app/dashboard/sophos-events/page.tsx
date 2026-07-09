import Link from "next/link";
import { getDb, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

interface EventRow {
  Id: number;
  ReceivedAt: string;
  DeviceName: string | null;
  LogComponent: string | null;
  LogSubtype: string | null;
  Fields: string | null;
}

// Fields already displayed elsewhere in the row, same convention as the System Health page.
const HIDDEN_KEYS = new Set([
  "date",
  "time",
  "timestamp",
  "timezone",
  "device_name",
  "device_id",
  "device_model",
  "device_serial_id",
  "log_id",
  "log_type",
  "log_component",
  "log_subtype",
  "log_version",
]);

function formatFields(json: string | null): string {
  if (!json) return "-";
  try {
    const obj = JSON.parse(json) as Record<string, string>;
    return Object.entries(obj)
      .filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== "")
      .map(([k, v]) => `${k}=${v}`)
      .join("  ") || "-";
  } catch {
    return "-";
  }
}

const COMPONENTS = ["Admin", "Authentication", "System"];

export default async function SophosEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ component?: string; page?: string }>;
}) {
  const { component: componentFilter, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();

  const whereClause = componentFilter ? "WHERE LogComponent = @component" : "";

  const countRequest = db.request();
  if (componentFilter) countRequest.input("component", sql.NVarChar, componentFilter);
  const countResult = await countRequest.query<{ Total: number }>(`SELECT COUNT(*) AS Total FROM SophosEventLogs ${whereClause}`);
  const total = countResult.recordset[0].Total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rowsRequest = db.request().input("offset", sql.Int, offset).input("limit", sql.Int, PAGE_SIZE);
  if (componentFilter) rowsRequest.input("component", sql.NVarChar, componentFilter);
  const rowsResult = await rowsRequest.query<EventRow>(`
    SELECT Id, ReceivedAt, DeviceName, LogComponent, LogSubtype, Fields
    FROM SophosEventLogs
    ${whereClause}
    ORDER BY ReceivedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const rows = rowsResult.recordset;

  return (
    <div>
      <h1>Sophos Events</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Admin console changes, authentication (firewall/user portal login-logout), and system-level events
        (reboots, HA failover, etc.) reported by the Sophos firewall.
      </p>

      <div className="flex gap-2 mb-4">
        {[{ label: "All", value: undefined }, ...COMPONENTS.map((c) => ({ label: c, value: c }))].map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/dashboard/sophos-events?component=${f.value}` : "/dashboard/sophos-events"}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: componentFilter === f.value ? "var(--primary)" : "var(--surface-2)",
              color: componentFilter === f.value ? "#fff" : "var(--ink-secondary)",
              fontSize: "0.8rem",
              textDecoration: "none",
            }}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="dash-panel">
        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No {componentFilter ? `${componentFilter} ` : ""}events received yet. Waiting for Sophos syslog data on port 5514.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>Component</th>
                    <th style={{ padding: "0.4rem" }}>Subtype</th>
                    <th style={{ padding: "0.4rem" }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.ReceivedAt).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>{r.LogComponent ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.LogSubtype ?? "-"}</td>
                      <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{formatFields(r.Fields)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", fontSize: "0.85rem" }}>
              <span>
                Page {page} of {totalPages} ({total} total)
              </span>
              <span>
                {page > 1 && (
                  <a
                    href={`/dashboard/sophos-events?${componentFilter ? `component=${componentFilter}&` : ""}page=${page - 1}`}
                    style={{ color: "var(--series-1)", marginRight: "1rem" }}
                  >
                    &larr; Prev
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`/dashboard/sophos-events?${componentFilter ? `component=${componentFilter}&` : ""}page=${page + 1}`}
                    style={{ color: "var(--series-1)" }}
                  >
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
