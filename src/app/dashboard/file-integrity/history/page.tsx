import Link from "next/link";
import { getDb, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

interface HistoryRow {
  Id: number;
  DeviceName: string | null;
  Hostname: string;
  FilePath: string;
  ChangeType: "Baseline" | "Modified" | "Deleted" | "Created";
  ModifiedBy: string | null;
  OldValue: string | null;
  NewValue: string | null;
  DetectedAt: string;
}

const valueBoxStyle = {
  maxHeight: 150,
  overflow: "auto" as const,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "0.4rem 0.5rem",
  fontSize: "0.78rem",
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
  minWidth: 200,
  maxWidth: 320,
};

const CHANGE_TYPE_COLOR: Record<string, string> = {
  Baseline: "var(--ink-muted)",
  Modified: "var(--warning)",
  Deleted: "var(--danger)",
  Created: "var(--success)",
};

export default async function FileIntegrityHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();

  const countResult = await db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM FileIntegrityEvents");
  const total = countResult.recordset[0].Total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rowsResult = await db
    .request()
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, PAGE_SIZE)
    .query<HistoryRow>(`
      SELECT e.Id, d.DeviceName, d.Hostname, e.FilePath, e.ChangeType, e.ModifiedBy, e.OldValue, e.NewValue,
        CONVERT(VARCHAR(19), e.DetectedAt, 126) AS DetectedAt
      FROM FileIntegrityEvents e
      JOIN Devices d ON d.DeviceId = e.DeviceId
      ORDER BY e.DetectedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  const rows = rowsResult.recordset;

  const pageHref = (p: number) => `/dashboard/file-integrity/history?page=${p}`;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Change History</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Every change detected on a watched file, across all devices. &quot;Who Modified&quot; is the device&apos;s
        currently logged-in user at the moment the change was detected - a best-effort signal, not a forensic guarantee.
      </p>

      <div className="dash-panel">
        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No file changes recorded yet.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                    <th style={{ padding: "0.4rem" }}>When</th>
                    <th style={{ padding: "0.4rem" }}>Device</th>
                    <th style={{ padding: "0.4rem" }}>File</th>
                    <th style={{ padding: "0.4rem" }}>Change</th>
                    <th style={{ padding: "0.4rem" }}>Who Modified</th>
                    <th style={{ padding: "0.4rem" }}>Old Value</th>
                    <th style={{ padding: "0.4rem" }}>New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap", verticalAlign: "top" }}>
                        {new Date(r.DetectedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.4rem", verticalAlign: "top" }}>{r.DeviceName ?? r.Hostname}</td>
                      <td style={{ padding: "0.4rem", fontFamily: "monospace", verticalAlign: "top" }}>{r.FilePath}</td>
                      <td style={{ padding: "0.4rem", verticalAlign: "top" }}>
                        <span style={{ color: CHANGE_TYPE_COLOR[r.ChangeType] ?? "var(--ink)", fontWeight: 600 }}>
                          {r.ChangeType}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem", verticalAlign: "top" }}>{r.ModifiedBy ?? "-"}</td>
                      <td style={{ padding: "0.4rem", verticalAlign: "top" }}>
                        {r.OldValue ? <div style={valueBoxStyle}>{r.OldValue}</div> : <span style={{ color: "var(--ink-muted)" }}>-</span>}
                      </td>
                      <td style={{ padding: "0.4rem", verticalAlign: "top" }}>
                        {r.NewValue ? <div style={valueBoxStyle}>{r.NewValue}</div> : <span style={{ color: "var(--ink-muted)" }}>-</span>}
                      </td>
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
