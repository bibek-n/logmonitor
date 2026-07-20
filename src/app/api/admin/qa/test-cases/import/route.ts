import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { withReferenceNumber } from "@/lib/qaReferenceNumbers";
import { parseCsv, csvRowsToRecords } from "@/lib/csv";
import { VALID_PRIORITIES, VALID_TEST_TYPES, type QaTestCaseRow } from "@/lib/qaShared";

const MAX_IMPORT_ROWS = 1000;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB — generous for a few thousand text rows

interface ImportRowResult {
  row: number;
  ok: boolean;
  testCaseNumber?: string;
  error?: string;
}

// CSV columns expected: Title (required), Description, Preconditions, ExpectedResult,
// Priority, Severity, TestType, EstimatedMinutes. ProjectId/TestSuiteId are NOT per-row
// columns — they come from the form fields below, since every imported row is added to one
// already-selected suite (matches the spec's "Import test cases from CSV" sitting inside
// test-case-within-a-suite management, not a cross-project bulk loader).
export async function POST(req: NextRequest) {
  const qa = await requireQaPermission("qa_create");
  if (!isQaSession(qa)) return qa;

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: "Invalid form submission." }, { status: 400 });
  }

  const projectId = Number(formData.get("projectId"));
  const testSuiteId = Number(formData.get("testSuiteId"));
  const file = formData.get("file");

  if (!Number.isInteger(projectId)) return NextResponse.json({ ok: false, error: "A valid projectId is required." }, { status: 400 });
  if (!Number.isInteger(testSuiteId)) return NextResponse.json({ ok: false, error: "A valid testSuiteId is required." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "A CSV file is required." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ ok: false, error: "The uploaded file is empty." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "File exceeds the 2MB import limit." }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ ok: false, error: "Only .csv files are accepted." }, { status: 400 });
  }

  const db = await getDb();
  const suiteCheck = await db.request().input("id", sql.Int, testSuiteId).query<{ Id: number; ProjectId: number }>(
    "SELECT Id, ProjectId FROM QaTestSuites WHERE Id = @id"
  );
  const suite = suiteCheck.recordset[0];
  if (!suite) return NextResponse.json({ ok: false, error: "Test suite not found." }, { status: 404 });
  if (suite.ProjectId !== projectId) {
    return NextResponse.json({ ok: false, error: "That test suite does not belong to the selected project." }, { status: 400 });
  }

  const text = await file.text();
  const records = csvRowsToRecords(parseCsv(text));

  if (records.length === 0) {
    return NextResponse.json({ ok: false, error: "No data rows found in the CSV." }, { status: 400 });
  }
  if (records.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ ok: false, error: `Import is capped at ${MAX_IMPORT_ROWS} rows per file (found ${records.length}).` }, { status: 400 });
  }

  const results: ImportRowResult[] = [];

  for (let i = 0; i < records.length; i++) {
    const rowNum = i + 2; // +1 for 0-index, +1 for the header row
    const record = records[i];
    const title = (record.Title ?? "").trim();

    if (!title) {
      results.push({ row: rowNum, ok: false, error: "Title is required." });
      continue;
    }
    if (title.length > 300) {
      results.push({ row: rowNum, ok: false, error: "Title exceeds 300 characters." });
      continue;
    }

    const priority = VALID_PRIORITIES.has(record.Priority) ? record.Priority : "Medium";
    const testType = VALID_TEST_TYPES.has(record.TestType) ? record.TestType : "Functional";
    const estimatedMinutesRaw = record.EstimatedMinutes ? Number(record.EstimatedMinutes) : null;
    const estimatedMinutes = estimatedMinutesRaw !== null && Number.isInteger(estimatedMinutesRaw) && estimatedMinutesRaw >= 0 ? estimatedMinutesRaw : null;

    try {
      const testCase = await withReferenceNumber("QaTestCases", "TestCaseNumber", "TC", async (transaction, testCaseNumber) => {
        const insertRequest = new sql.Request(transaction);
        const insertResult = await insertRequest
          .input("projectId", sql.Int, projectId)
          .input("testSuiteId", sql.Int, testSuiteId)
          .input("testCaseNumber", sql.VarChar, testCaseNumber)
          .input("title", sql.NVarChar, title)
          .input("description", sql.NVarChar, record.Description || null)
          .input("preconditions", sql.NVarChar, record.Preconditions || null)
          .input("expectedResult", sql.NVarChar, record.ExpectedResult || null)
          .input("priority", sql.VarChar, priority)
          .input("severity", sql.VarChar, record.Severity || null)
          .input("testType", sql.VarChar, testType)
          .input("estimatedMinutes", sql.Int, estimatedMinutes)
          .input("createdByUserId", sql.Int, qa.userId)
          .query<QaTestCaseRow>(`
            INSERT INTO QaTestCases (
              ProjectId, TestSuiteId, TestCaseNumber, Title, Description, Preconditions,
              ExpectedResult, Priority, Severity, TestType, EstimatedMinutes,
              CreatedByUserId, UpdatedByUserId
            )
            OUTPUT INSERTED.*
            VALUES (
              @projectId, @testSuiteId, @testCaseNumber, @title, @description, @preconditions,
              @expectedResult, @priority, @severity, @testType, @estimatedMinutes,
              @createdByUserId, @createdByUserId
            )
          `);
        return insertResult.recordset[0];
      });

      results.push({ row: rowNum, ok: true, testCaseNumber: testCase.TestCaseNumber });
      await logQaActivity({ entityType: "TestCase", entityId: testCase.Id, action: "import", userId: qa.userId, newValue: testCase, req });
    } catch (err) {
      results.push({ row: rowNum, ok: false, error: err instanceof Error ? err.message : "Insert failed." });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  await logAdminAction({
    admin: qa, section: "qa", action: "import_test_cases",
    details: `${successCount}/${records.length} rows imported into suite ${testSuiteId}`, req,
  });

  return NextResponse.json({ ok: true, data: { total: records.length, imported: successCount, results } });
}
