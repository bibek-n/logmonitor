import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { logQaActivity } from "@/lib/qaActivityLog";
import { withReferenceNumber } from "@/lib/qaReferenceNumbers";
import type { QaTestCaseRow, QaTestCaseStepRow } from "@/lib/qaShared";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const qa = await requireQaPermission("qa_create");
  if (!isQaSession(qa)) return qa;

  const { id } = await params;
  const sourceId = Number(id);
  if (!Number.isInteger(sourceId)) {
    return NextResponse.json({ ok: false, error: "Invalid test case id." }, { status: 400 });
  }

  const db = await getDb();
  const sourceResult = await db.request().input("id", sql.Int, sourceId).query<QaTestCaseRow>(
    "SELECT * FROM QaTestCases WHERE Id = @id"
  );
  const source = sourceResult.recordset[0];
  if (!source) {
    return NextResponse.json({ ok: false, error: "Test case not found." }, { status: 404 });
  }

  const [stepsResult, tagsResult] = await Promise.all([
    db.request().input("id", sql.Int, sourceId).query<QaTestCaseStepRow>(
      "SELECT StepNumber, Action, TestData, ExpectedResult FROM QaTestCaseSteps WHERE TestCaseId = @id ORDER BY StepNumber ASC"
    ),
    db.request().input("id", sql.Int, sourceId).query<{ Tag: string }>("SELECT Tag FROM QaTestCaseTags WHERE TestCaseId = @id"),
  ]);

  const clonedTitle = `${source.Title} (Copy)`.slice(0, 300);

  const cloned = await withReferenceNumber("QaTestCases", "TestCaseNumber", "TC", async (transaction, testCaseNumber) => {
    const insertRequest = new sql.Request(transaction);
    const insertResult = await insertRequest
      .input("projectId", sql.Int, source.ProjectId)
      .input("moduleId", sql.Int, source.ModuleId)
      .input("testSuiteId", sql.Int, source.TestSuiteId)
      .input("testCaseNumber", sql.VarChar, testCaseNumber)
      .input("title", sql.NVarChar, clonedTitle)
      .input("description", sql.NVarChar, source.Description)
      .input("preconditions", sql.NVarChar, source.Preconditions)
      .input("expectedResult", sql.NVarChar, source.ExpectedResult)
      .input("priority", sql.VarChar, source.Priority)
      .input("severity", sql.VarChar, source.Severity)
      .input("testType", sql.VarChar, source.TestType)
      .input("automationStatus", sql.VarChar, source.AutomationStatus)
      .input("estimatedMinutes", sql.Int, source.EstimatedMinutes)
      .input("createdByUserId", sql.Int, qa.userId)
      .query<QaTestCaseRow>(`
        INSERT INTO QaTestCases (
          ProjectId, ModuleId, TestSuiteId, TestCaseNumber, Title, Description, Preconditions,
          ExpectedResult, Priority, Severity, TestType, AutomationStatus, EstimatedMinutes,
          Status, CreatedByUserId, UpdatedByUserId
        )
        OUTPUT INSERTED.*
        VALUES (
          @projectId, @moduleId, @testSuiteId, @testCaseNumber, @title, @description, @preconditions,
          @expectedResult, @priority, @severity, @testType, @automationStatus, @estimatedMinutes,
          'Draft', @createdByUserId, @createdByUserId
        )
      `);
    const row = insertResult.recordset[0];

    for (const step of stepsResult.recordset) {
      const stepRequest = new sql.Request(transaction);
      await stepRequest
        .input("testCaseId", sql.Int, row.Id)
        .input("stepNumber", sql.Int, step.StepNumber)
        .input("action", sql.NVarChar, step.Action)
        .input("testData", sql.NVarChar, step.TestData)
        .input("expectedResult", sql.NVarChar, step.ExpectedResult)
        .query("INSERT INTO QaTestCaseSteps (TestCaseId, StepNumber, Action, TestData, ExpectedResult) VALUES (@testCaseId, @stepNumber, @action, @testData, @expectedResult)");
    }
    for (const tagRow of tagsResult.recordset) {
      const tagRequest = new sql.Request(transaction);
      await tagRequest.input("testCaseId", sql.Int, row.Id).input("tag", sql.NVarChar, tagRow.Tag)
        .query("INSERT INTO QaTestCaseTags (TestCaseId, Tag) VALUES (@testCaseId, @tag)");
    }

    return row;
  });

  await logAdminAction({ admin: qa, section: "qa", action: "clone_test_case", details: `${source.TestCaseNumber} -> ${cloned.TestCaseNumber}`, req });
  await logQaActivity({
    entityType: "TestCase", entityId: cloned.Id, action: "clone", userId: qa.userId,
    previousValue: { clonedFrom: source.TestCaseNumber }, newValue: cloned, req,
  });

  return NextResponse.json({ ok: true, data: cloned });
}
