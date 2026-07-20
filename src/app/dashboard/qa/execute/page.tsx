import Link from "next/link";
import { getDb, sql } from "@/lib/db";
import { getQaSession } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EXECUTION_RESULT_TONE, PRIORITY_TONE, toneFor } from "@/lib/qaBadgeTones";

export const dynamic = "force-dynamic";

interface AssignmentRow {
  RunCaseId: number;
  TestRunNumber: string;
  TestRunName: string;
  TestCaseNumber: string;
  Title: string;
  Priority: string;
  LatestResult: string | null;
}

export default async function ExecuteTestListPage() {
  const qa = await getQaSession("qa_execute");
  if (!qa) return <QaAccessDenied title="Execute Test" />;

  const db = await getDb();
  const result = await db.request().input("userId", sql.Int, qa.userId).query<AssignmentRow>(`
    SELECT rc.Id AS RunCaseId, r.TestRunNumber, r.Name AS TestRunName,
      tc.TestCaseNumber, tc.Title, tc.Priority, latest.Result AS LatestResult
    FROM QaTestRunCases rc
    JOIN QaTestRuns r ON r.Id = rc.TestRunId
    JOIN QaTestCases tc ON tc.Id = rc.TestCaseId
    OUTER APPLY (SELECT TOP 1 e.Result FROM QaTestExecutions e WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC) latest
    WHERE rc.AssignedUserId = @userId AND r.Status NOT IN ('Completed', 'Cancelled')
    ORDER BY r.CreatedAt DESC, tc.TestCaseNumber ASC
  `);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Execute Test</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Test cases assigned to you across every active run.
      </p>

      {result.recordset.length === 0 ? (
        <Card>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", margin: 0 }}>Nothing assigned to you right now.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {result.recordset.map((a) => (
            <Link
              key={a.RunCaseId}
              href={`/dashboard/qa/execute/${a.RunCaseId}`}
              className="flex items-center justify-between"
              style={{ padding: "0.75rem 1rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", textDecoration: "none" }}
            >
              <div>
                <div style={{ fontSize: "0.88rem", color: "var(--ink)" }}>
                  <span style={{ fontFamily: "monospace", color: "var(--ink-muted)", marginRight: 8 }}>{a.TestCaseNumber}</span>
                  {a.Title}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>{a.TestRunNumber} · {a.TestRunName}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={toneFor(PRIORITY_TONE, a.Priority)}>{a.Priority}</Badge>
                <Badge tone={toneFor(EXECUTION_RESULT_TONE, a.LatestResult ?? "Not Run")}>{a.LatestResult ?? "Not Run"}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
