import Link from "next/link";
import { ClipboardCheck, FolderTree, PlayCircle, Bug, CheckCircle2, Clock } from "lucide-react";
import { getDb } from "@/lib/db";
import { getQaSession } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BUG_STATUS_TONE, TEST_RUN_STATUS_TONE, EXECUTION_RESULT_TONE, toneFor } from "@/lib/qaBadgeTones";

export const dynamic = "force-dynamic";

interface Kpi {
  label: string;
  value: string | number;
  icon: typeof ClipboardCheck;
}

interface RecentBugRow {
  Id: number;
  BugNumber: string;
  Title: string;
  Severity: string;
  Status: string;
}

interface RecentRunRow {
  Id: number;
  TestRunNumber: string;
  Name: string;
  Status: string;
  ProjectName: string;
  CreatedAt: string;
}

interface ProjectProgressRow {
  Id: number;
  Name: string;
  TestCases: number;
  TestSuites: number;
  TestRuns: number;
  OpenBugs: number;
}

const RESULT_ORDER = ["Passed", "Failed", "Blocked", "Skipped", "Not Run"];

export default async function QaDashboardPage() {
  const qa = await getQaSession("qa_view");
  if (!qa) return <QaAccessDenied title="QA Dashboard" />;

  const db = await getDb();
  const [
    testCases, testSuites, testRuns, activeRuns, openBugs, resultBreakdown,
    recentBugs, recentRuns, projectRows, projectPassRate,
  ] = await Promise.all([
    db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM QaTestCases WHERE Status <> 'Archived'`,
    db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM QaTestSuites WHERE Status <> 'Archived'`,
    db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM QaTestRuns`,
    db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM QaTestRuns WHERE Status = 'In Progress'`,
    db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM QaBugs WHERE Status NOT IN ('Closed', 'Rejected', 'Duplicate')`,
    // Every test-run-case's latest execution result, bucketed — this is "all results" (Passed/
    // Failed/Blocked/Skipped), plus "Not Run" for cases added to a run but never executed yet.
    db.query<{ Result: string; Cnt: number }>`
      SELECT COALESCE(latest.Result, 'Not Run') AS Result, COUNT(*) AS Cnt
      FROM QaTestRunCases rc
      OUTER APPLY (SELECT TOP 1 e.Result FROM QaTestExecutions e WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC) latest
      GROUP BY COALESCE(latest.Result, 'Not Run')
    `,
    db.query<RecentBugRow>`
      SELECT TOP 6 Id, BugNumber, Title, Severity, Status FROM QaBugs
      WHERE Status NOT IN ('Closed', 'Rejected', 'Duplicate') ORDER BY CreatedAt DESC
    `,
    db.query<RecentRunRow>`
      SELECT TOP 8 r.Id, r.TestRunNumber, r.Name, r.Status, p.Name AS ProjectName,
        CONVERT(VARCHAR(19), r.CreatedAt, 126) AS CreatedAt
      FROM QaTestRuns r JOIN QaProjects p ON p.Id = r.ProjectId
      ORDER BY r.CreatedAt DESC
    `,
    db.query<ProjectProgressRow>`
      SELECT p.Id, p.Name,
        (SELECT COUNT(*) FROM QaTestCases WHERE ProjectId = p.Id AND Status <> 'Archived') AS TestCases,
        (SELECT COUNT(*) FROM QaTestSuites WHERE ProjectId = p.Id AND Status <> 'Archived') AS TestSuites,
        (SELECT COUNT(*) FROM QaTestRuns WHERE ProjectId = p.Id) AS TestRuns,
        (SELECT COUNT(*) FROM QaBugs WHERE ProjectId = p.Id AND Status NOT IN ('Closed', 'Rejected', 'Duplicate')) AS OpenBugs
      FROM QaProjects p
      WHERE p.IsActive = 1
      ORDER BY p.Name ASC
    `,
    db.query<{ ProjectId: number; Passed: number; Total: number }>`
      SELECT r.ProjectId,
        SUM(CASE WHEN latest.Result = 'Passed' THEN 1 ELSE 0 END) AS Passed,
        COUNT(*) AS Total
      FROM QaTestRunCases rc
      JOIN QaTestRuns r ON r.Id = rc.TestRunId
      OUTER APPLY (SELECT TOP 1 e.Result FROM QaTestExecutions e WHERE e.TestRunCaseId = rc.Id ORDER BY e.ExecutedAt DESC) latest
      WHERE latest.Result IS NOT NULL
      GROUP BY r.ProjectId
    `,
  ]);

  const resultCounts = new Map(resultBreakdown.recordset.map((r) => [r.Result, r.Cnt]));
  const passed = resultCounts.get("Passed") ?? 0;
  const totalExecuted = [...resultCounts.entries()].reduce((sum, [result, cnt]) => (result === "Not Run" ? sum : sum + cnt), 0);
  const passRatePercent = totalExecuted > 0 ? Math.round((passed / totalExecuted) * 1000) / 10 : null;

  const kpis: Kpi[] = [
    { label: "Total Test Cases", value: testCases.recordset[0]?.Cnt ?? 0, icon: ClipboardCheck },
    { label: "Active Test Suites", value: testSuites.recordset[0]?.Cnt ?? 0, icon: FolderTree },
    { label: "Test Runs", value: `${activeRuns.recordset[0]?.Cnt ?? 0} active / ${testRuns.recordset[0]?.Cnt ?? 0} total`, icon: PlayCircle },
    { label: "Open Bugs", value: openBugs.recordset[0]?.Cnt ?? 0, icon: Bug },
    { label: "Pass Rate", value: passRatePercent !== null ? `${passRatePercent}%` : "—", icon: CheckCircle2 },
  ];

  const passRateByProject = new Map(projectPassRate.recordset.map((r) => [r.ProjectId, r]));

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>QA Dashboard</h1>
        <Link href="/dashboard/qa/reports" style={{ color: "var(--primary)", fontSize: "0.85rem" }}>
          View full reports →
        </Link>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Test suites, test cases, test runs, and bug tracking at a glance.
      </p>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {kpis.map((k) => (
          <Card key={k.label} className="flex items-center gap-3">
            <k.icon size={22} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--ink)" }}>{k.value}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{k.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mb-5">
        <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.9rem" }}>Test Results (all executions, latest per test case)</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          {RESULT_ORDER.map((result) => (
            <div
              key={result}
              className="flex items-center justify-between"
              style={{ padding: "0.7rem 0.9rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}
            >
              <Badge tone={toneFor(EXECUTION_RESULT_TONE, result)}>{result === "Not Run" ? "Pending" : result}</Badge>
              <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>{resultCounts.get(result) ?? 0}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))" }}>
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Recent Test Runs</h2>
            <Link href="/dashboard/qa/test-runs" style={{ color: "var(--primary)", fontSize: "0.8rem" }}>
              View all →
            </Link>
          </div>
          {recentRuns.recordset.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No test runs yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentRuns.recordset.map((r) => (
                <Link
                  key={r.Id}
                  href={`/dashboard/qa/test-runs/${r.Id}`}
                  className="flex items-center justify-between"
                  style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <span style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
                    <span style={{ color: "var(--ink-muted)", fontFamily: "monospace", marginRight: 8 }}>{r.TestRunNumber}</span>
                    {r.Name}
                    <span style={{ color: "var(--ink-faint, var(--ink-muted))", fontSize: "0.75rem", marginLeft: 8 }}>{r.ProjectName}</span>
                  </span>
                  <Badge tone={toneFor(TEST_RUN_STATUS_TONE, r.Status)}>{r.Status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Recent Open Bugs</h2>
            <Link href="/dashboard/qa/bugs" style={{ color: "var(--primary)", fontSize: "0.8rem" }}>
              View all →
            </Link>
          </div>
          {recentBugs.recordset.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No open bugs — nice work.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {recentBugs.recordset.map((b) => (
                <Link
                  key={b.Id}
                  href={`/dashboard/qa/bugs/${b.Id}`}
                  className="flex items-center justify-between"
                  style={{ padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border)", textDecoration: "none" }}
                >
                  <span style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
                    <span style={{ color: "var(--ink-muted)", fontFamily: "monospace", marginRight: 8 }}>{b.BugNumber}</span>
                    {b.Title}
                  </span>
                  <Badge tone={toneFor(BUG_STATUS_TONE, b.Status)}>{b.Status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.9rem" }}>Progress by Project</h2>
        {projectRows.recordset.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No QA projects yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Project", "Test Cases", "Suites", "Runs", "Pass Rate", "Open Bugs"].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 0.75rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectRows.recordset.map((p) => {
                  const pr = passRateByProject.get(p.Id);
                  const pct = pr && pr.Total > 0 ? Math.round((pr.Passed / pr.Total) * 1000) / 10 : null;
                  return (
                    <tr key={p.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: 500 }}>{p.Name}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{p.TestCases}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{p.TestSuites}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{p.TestRuns}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        {pct !== null ? (
                          <Badge tone={pct >= 80 ? "success" : pct >= 50 ? "warning" : "danger"}>{pct}%</Badge>
                        ) : (
                          <span style={{ color: "var(--ink-muted)" }}>
                            <Clock size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
                            No executions yet
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{p.OpenBugs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
