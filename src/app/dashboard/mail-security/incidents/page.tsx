import Link from "next/link";
import { getMailSession } from "@/lib/requireMailPolicyPermission";
import { getDb, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

interface IncidentRow {
  Id: number;
  IncidentId: string;
  Source: string;
  Direction: string;
  Sender: string;
  Recipients: string;
  Subject: string | null;
  PolicyName: string | null;
  ActionTaken: string;
  BlockReason: string | null;
  DetectedAt: string;
}

const ACTION_COLOR: Record<string, string> = {
  Reject: "var(--danger)",
  Block: "var(--danger)",
  Quarantine: "var(--warning)",
  RemoveAttachment: "var(--warning)",
  Warn: "var(--warning)",
  Allow: "var(--success)",
};

export default async function MailIncidentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const mail = await getMailSession("mail_view_incidents");
  if (!mail) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Incidents</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Mail Protection incidents.</p>
      </div>
    );
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const db = await getDb();
  const countResult = await db.query<{ Total: number }>("SELECT COUNT(*) AS Total FROM MailSecurityIncidents");
  const total = countResult.recordset[0].Total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const rowsResult = await db
    .request()
    .input("offset", sql.Int, offset)
    .input("limit", sql.Int, PAGE_SIZE)
    .query<IncidentRow>(`
      SELECT i.Id, CAST(i.IncidentId AS VARCHAR(36)) AS IncidentId, i.Source, i.Direction, i.Sender, i.Recipients, i.Subject,
        p.Name AS PolicyName, i.ActionTaken, i.BlockReason, CONVERT(VARCHAR(19), i.DetectedAt, 126) AS DetectedAt
      FROM MailSecurityIncidents i
      LEFT JOIN MailBlockingPolicies p ON p.Id = i.MatchedPolicyId
      ORDER BY i.DetectedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  const rows = rowsResult.recordset;

  const pageHref = (p: number) => `/dashboard/mail-security/incidents?page=${p}`;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Incidents</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Every message the policy engine evaluated. Stage 1 has no live provider connected, so every row here comes
        from the Test Policy simulator (Source = Simulation) - none of these reflect real mail traffic yet.
      </p>

      <div className="dash-panel">
        {rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No incidents recorded yet - use &quot;Test&quot; on a policy to generate one.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                    <th style={{ padding: "0.4rem" }}>When</th>
                    <th style={{ padding: "0.4rem" }}>Source</th>
                    <th style={{ padding: "0.4rem" }}>Direction</th>
                    <th style={{ padding: "0.4rem" }}>Sender</th>
                    <th style={{ padding: "0.4rem" }}>Recipients</th>
                    <th style={{ padding: "0.4rem" }}>Policy</th>
                    <th style={{ padding: "0.4rem" }}>Action</th>
                    <th style={{ padding: "0.4rem" }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{new Date(r.DetectedAt).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Source}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Direction}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Sender}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Recipients}</td>
                      <td style={{ padding: "0.4rem" }}>{r.PolicyName ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <span style={{ color: ACTION_COLOR[r.ActionTaken] ?? "var(--ink)", fontWeight: 600 }}>{r.ActionTaken}</span>
                      </td>
                      <td style={{ padding: "0.4rem", maxWidth: 320 }}>{r.BlockReason ?? "-"}</td>
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
