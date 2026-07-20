import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getQaAccess } from "@/lib/requireQaPermission";
import { QaAccessDenied } from "@/components/qa/QaAccessDenied";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TEST_CASE_STATUS_TONE, TEST_SUITE_STATUS_TONE, PRIORITY_TONE, toneFor } from "@/lib/qaBadgeTones";
import { TestSuiteDetailActions } from "@/components/qa/TestSuiteDetailActions";

export const dynamic = "force-dynamic";

interface SuiteDetail {
  Id: number;
  ProjectId: number;
  ModuleId: number | null;
  Name: string;
  Description: string | null;
  RequirementRef: string | null;
  Status: string;
  CreatedAt: string;
  UpdatedAt: string;
}

interface CaseRow {
  Id: number;
  TestCaseNumber: string;
  Title: string;
  Priority: string;
  Status: string;
}

export default async function TestSuiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { qa, can } = await getQaAccess();
  if (!qa) return <QaAccessDenied title="Test Suite" />;

  const { id } = await params;
  const suiteId = Number(id);
  if (!Number.isInteger(suiteId)) notFound();

  const db = await getDb();
  const [suiteResult, projectResult, moduleResult, casesResult] = await Promise.all([
    db.request().input("id", sql.Int, suiteId).query<SuiteDetail>(`
      SELECT Id, ProjectId, ModuleId, Name, Description, RequirementRef, Status,
        CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
      FROM QaTestSuites WHERE Id = @id
    `),
    db.request().input("id", sql.Int, suiteId).query<{ Name: string }>(`
      SELECT p.Name FROM QaProjects p JOIN QaTestSuites s ON s.ProjectId = p.Id WHERE s.Id = @id
    `),
    db.request().input("id", sql.Int, suiteId).query<{ Name: string }>(`
      SELECT m.Name FROM QaModules m JOIN QaTestSuites s ON s.ModuleId = m.Id WHERE s.Id = @id
    `),
    db.request().input("id", sql.Int, suiteId).query<CaseRow>(`
      SELECT Id, TestCaseNumber, Title, Priority, Status FROM QaTestCases
      WHERE TestSuiteId = @id AND Status <> 'Archived' ORDER BY TestCaseNumber ASC
    `),
  ]);

  const suite = suiteResult.recordset[0];
  if (!suite) notFound();

  const projects = await db.query<{ Id: number; Name: string }>`SELECT Id, Name FROM QaProjects WHERE IsActive = 1 ORDER BY Name ASC`;
  const modules = await db.request().input("projectId", sql.Int, suite.ProjectId).query<{ Id: number; ProjectId: number; Name: string }>(
    "SELECT Id, ProjectId, Name FROM QaModules WHERE ProjectId = @projectId ORDER BY Name ASC"
  );

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{suite.Name}</h1>
        <TestSuiteDetailActions
          suite={suite}
          modules={modules.recordset}
          canEdit={!!can.qa_edit}
          canDelete={!!can.qa_delete}
        />
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        {projectResult.recordset[0]?.Name ?? "—"}
        {moduleResult.recordset[0]?.Name ? ` / ${moduleResult.recordset[0].Name}` : ""}
      </p>

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge tone={toneFor(TEST_SUITE_STATUS_TONE, suite.Status)}>{suite.Status}</Badge>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
            Updated {new Date(suite.UpdatedAt).toLocaleString()}
          </span>
        </div>
        <p style={{ fontSize: "0.88rem", color: "var(--ink-secondary)", margin: 0 }}>{suite.Description ?? "No description."}</p>
        {suite.RequirementRef && (
          <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: "0.5rem 0 0" }}>
            <strong style={{ color: "var(--ink-secondary)" }}>Requirement:</strong> {suite.RequirementRef}
          </p>
        )}
      </Card>

      <Card style={{ padding: 0 }}>
        <div className="flex items-center justify-between" style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Test Cases ({casesResult.recordset.length})</h2>
          <Link href={`/dashboard/qa/test-cases?testSuiteId=${suite.Id}`} style={{ color: "var(--primary)", fontSize: "0.8rem" }}>
            Manage in Test Cases →
          </Link>
        </div>
        {casesResult.recordset.length === 0 ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>No test cases in this suite yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  {["Number", "Title", "Priority", "Status"].map((h) => (
                    <th key={h} style={{ padding: "0.5rem 1rem", color: "var(--ink-muted)", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {casesResult.recordset.map((c) => (
                  <tr key={c.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 1rem", fontFamily: "monospace" }}>
                      <Link href={`/dashboard/qa/test-cases/${c.Id}`} style={{ color: "var(--primary)" }}>{c.TestCaseNumber}</Link>
                    </td>
                    <td style={{ padding: "0.5rem 1rem" }}>{c.Title}</td>
                    <td style={{ padding: "0.5rem 1rem" }}><Badge tone={toneFor(PRIORITY_TONE, c.Priority)}>{c.Priority}</Badge></td>
                    <td style={{ padding: "0.5rem 1rem" }}><Badge tone={toneFor(TEST_CASE_STATUS_TONE, c.Status)}>{c.Status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
