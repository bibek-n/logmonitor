import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { rowsToCsv } from "@/lib/csv";
import { buildTestCaseFilters, type QaTestCaseRow } from "@/lib/qaShared";

const EXPORT_CAP = 5000;

const HEADERS = [
  "TestCaseNumber", "Title", "ProjectId", "ModuleId", "TestSuiteId", "Priority", "Severity",
  "TestType", "AutomationStatus", "Status", "EstimatedMinutes", "Description", "Preconditions",
  "ExpectedResult", "CreatedAt", "UpdatedAt",
];

// Same file-download convention already used elsewhere in this app (ticket attachments,
// website-security PDF reports, settings backup export): a GET route under
// requireQaPermission(), body built as a plain string, returned with a Content-Disposition
// header — no new pattern introduced.
export async function GET(req: NextRequest) {
  const qa = await requireQaPermission("qa_view_reports");
  if (!isQaSession(qa)) return qa;

  const sp = req.nextUrl.searchParams;
  const { conditions, params, error } = buildTestCaseFilters(sp);
  if (error) return NextResponse.json({ ok: false, error }, { status: 400 });
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = await getDb();
  const request = db.request();
  for (const p of params) request.input(p.name, p.type, p.value);

  const result = await request.query<QaTestCaseRow>(`
    SELECT TOP ${EXPORT_CAP} TestCaseNumber, Title, ProjectId, ModuleId, TestSuiteId, Priority,
      Severity, TestType, AutomationStatus, Status, EstimatedMinutes, Description, Preconditions,
      ExpectedResult,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM QaTestCases ${where}
    ORDER BY TestCaseNumber ASC
  `);

  const csv = rowsToCsv(
    HEADERS,
    result.recordset.map((r) => HEADERS.map((h) => (r as unknown as Record<string, unknown>)[h]))
  );

  await logAdminAction({ admin: qa, section: "qa", action: "export_test_cases", details: `${result.recordset.length} rows`, req });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qa-test-cases-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
