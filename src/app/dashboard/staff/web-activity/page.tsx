import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDb, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface ActivityRow {
  Id: number;
  ReceivedAt: string;
  SrcIp: string;
  DstIp: string | null;
  DstPort: number | null;
  ReverseDns: string | null;
  StaffId: number;
  StaffName: string;
}

// Every (StaffId, IpAddress) pair any employee's MAC has ever held on either network - the same
// correlation employees/[id]/page.tsx uses for its own per-employee report, just gathered for
// every employee at once instead of one at a time, so a single combined feed can be paginated
// chronologically across the whole staff roster rather than requiring one page load per person.
const STAFF_IPS_CTE = `
  WITH StaffIps AS (
    SELECT s.Id AS StaffId, s.Name AS StaffName, rc.IpAddress
    FROM Staff s
    JOIN RouterClients rc ON UPPER(rc.MacAddress) = UPPER(s.MacAddress)
    WHERE s.MacAddress IS NOT NULL
    UNION
    SELECT s.Id AS StaffId, s.Name AS StaffName, sc.IpAddress
    FROM Staff s
    JOIN SophosClients sc ON UPPER(sc.MacAddress) = UPPER(s.MacAddress)
    WHERE s.MacAddress IS NOT NULL
  )
`;

export default async function EmployeeWebActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const t = await getTranslations("employees.webActivity");
  const td = await getTranslations("employees.detail");

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();

  const countResult = await db.query<{ Total: number }>(`
    ${STAFF_IPS_CTE}
    SELECT COUNT(*) AS Total FROM RouterWebLogs rwl JOIN StaffIps si ON si.IpAddress = rwl.SrcIp
  `);
  const total = countResult.recordset[0].Total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rowsResult = await db
    .request()
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, PAGE_SIZE)
    .query<ActivityRow>(`
      ${STAFF_IPS_CTE}
      SELECT rwl.Id, CONVERT(VARCHAR(19), rwl.ReceivedAt, 126) AS ReceivedAt, rwl.SrcIp, rwl.DstIp, rwl.DstPort, rwl.ReverseDns,
        si.StaffId, si.StaffName
      FROM RouterWebLogs rwl
      JOIN StaffIps si ON si.IpAddress = rwl.SrcIp
      ORDER BY rwl.ReceivedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  const rows = rowsResult.recordset;

  const pageHref = (p: number) => `/dashboard/staff/web-activity?page=${p}`;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>{t("pageTitle")}</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "0.75rem" }}>
        <Link href="/dashboard/staff" style={{ color: "var(--series-1)" }}>
          &larr; {td("backToAllLink")}
        </Link>
      </p>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>{t("subtitle")}</p>

      <div className="dash-panel">
        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>{t("noActivity")}</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>{td("timeColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{t("employeeColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{td("ipColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{td("destinationColumn")}</th>
                    <th style={{ padding: "0.4rem" }}>{td("portColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.ReceivedAt).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/staff/${r.StaffId}`} style={{ color: "var(--series-1)" }}>
                          {r.StaffName}
                        </Link>
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/router-web/${encodeURIComponent(r.SrcIp)}`} style={{ color: "var(--series-1)" }}>
                          {r.SrcIp}
                        </Link>
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        {r.ReverseDns ?? r.DstIp ?? "-"}
                        {r.ReverseDns && <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}> ({r.DstIp})</span>}
                      </td>
                      <td style={{ padding: "0.4rem" }}>{r.DstPort ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", fontSize: "0.85rem" }}>
              <span>{t("pageOf", { page, totalPages })}</span>
              <span>
                {page > 1 && (
                  <Link href={pageHref(page - 1)} style={{ color: "var(--series-1)", marginRight: "1rem" }}>
                    &larr; {t("prevPage")}
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={pageHref(page + 1)} style={{ color: "var(--series-1)" }}>
                    {t("nextPage")} &rarr;
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
