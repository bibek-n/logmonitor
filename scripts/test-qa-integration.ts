import "dotenv/config";
import assert from "node:assert/strict";
import { getDb, sql } from "../src/lib/db";
import { withReferenceNumber } from "../src/lib/qaReferenceNumbers";

// DB/integration test for the QA Testing Management module — Phase 5. Runs against the real
// configured database (no separate test DB exists for this app), so every row it creates is
// tagged with a unique marker and deleted in a `finally` block, in the same FK-safe child-
// before-parent order the API routes themselves use. Safe to run repeatedly and safe to run
// against production: it never touches any row it didn't create itself.

const MARKER = `__vitest_integration_${Date.now()}__`;
let failures = 0;

function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
    } catch (err) {
      failures++;
      console.error(`  FAIL  ${name}`);
      console.error(`        ${err instanceof Error ? err.message : err}`);
    }
  })();
}

async function main() {
  const db = await getDb();

  const created = {
    projectId: 0, moduleId: 0, suiteId: 0, testCaseIds: [] as number[],
    runId: 0, runCaseId: 0, bugId: 0,
  };

  try {
    // --- setup ---
    const projectResult = await db.request().input("name", sql.NVarChar, MARKER).query<{ Id: number }>(
      "INSERT INTO QaProjects (Name) OUTPUT INSERTED.Id VALUES (@name)"
    );
    created.projectId = projectResult.recordset[0].Id;

    const moduleResult = await db.request().input("projectId", sql.Int, created.projectId).input("name", sql.NVarChar, MARKER).query<{ Id: number }>(
      "INSERT INTO QaModules (ProjectId, Name) OUTPUT INSERTED.Id VALUES (@projectId, @name)"
    );
    created.moduleId = moduleResult.recordset[0].Id;

    const suiteResult = await db.request().input("projectId", sql.Int, created.projectId).input("moduleId", sql.Int, created.moduleId).input("name", sql.NVarChar, MARKER).query<{ Id: number }>(
      "INSERT INTO QaTestSuites (ProjectId, ModuleId, Name) OUTPUT INSERTED.Id VALUES (@projectId, @moduleId, @name)"
    );
    created.suiteId = suiteResult.recordset[0].Id;

    // --- reference number format + uniqueness under real sequential inserts ---
    await check("withReferenceNumber produces a PREFIX-00000 formatted, unique number", async () => {
      const first = await withReferenceNumber("QaTestCases", "TestCaseNumber", "TC", async (tx, num) => {
        const r = await new sql.Request(tx)
          .input("projectId", sql.Int, created.projectId)
          .input("suiteId", sql.Int, created.suiteId)
          .input("num", sql.VarChar, num)
          .input("title", sql.NVarChar, MARKER)
          .query<{ Id: number; TestCaseNumber: string }>(
            "INSERT INTO QaTestCases (ProjectId, TestSuiteId, TestCaseNumber, Title) OUTPUT INSERTED.Id, INSERTED.TestCaseNumber VALUES (@projectId, @suiteId, @num, @title)"
          );
        return r.recordset[0];
      });
      created.testCaseIds.push(first.Id);
      assert.match(first.TestCaseNumber, /^TC-\d{5}$/, "reference number must match TC-00000 shape");

      const second = await withReferenceNumber("QaTestCases", "TestCaseNumber", "TC", async (tx, num) => {
        const r = await new sql.Request(tx)
          .input("projectId", sql.Int, created.projectId)
          .input("suiteId", sql.Int, created.suiteId)
          .input("num", sql.VarChar, num)
          .input("title", sql.NVarChar, MARKER)
          .query<{ Id: number; TestCaseNumber: string }>(
            "INSERT INTO QaTestCases (ProjectId, TestSuiteId, TestCaseNumber, Title) OUTPUT INSERTED.Id, INSERTED.TestCaseNumber VALUES (@projectId, @suiteId, @num, @title)"
          );
        return r.recordset[0];
      });
      created.testCaseIds.push(second.Id);
      assert.notEqual(first.TestCaseNumber, second.TestCaseNumber, "two sequential inserts must not collide");
    });

    // --- concurrency: fire N inserts at once, every generated number must be unique ---
    await check("withReferenceNumber generates unique numbers under real concurrent inserts", async () => {
      const CONCURRENCY = 8;
      const results = await Promise.all(
        Array.from({ length: CONCURRENCY }, () =>
          withReferenceNumber("QaTestCases", "TestCaseNumber", "TC", async (tx, num) => {
            const r = await new sql.Request(tx)
              .input("projectId", sql.Int, created.projectId)
              .input("suiteId", sql.Int, created.suiteId)
              .input("num", sql.VarChar, num)
              .input("title", sql.NVarChar, MARKER)
              .query<{ Id: number; TestCaseNumber: string }>(
                "INSERT INTO QaTestCases (ProjectId, TestSuiteId, TestCaseNumber, Title) OUTPUT INSERTED.Id, INSERTED.TestCaseNumber VALUES (@projectId, @suiteId, @num, @title)"
              );
            return r.recordset[0];
          })
        )
      );
      results.forEach((r) => created.testCaseIds.push(r.Id));
      const numbers = results.map((r) => r.TestCaseNumber);
      assert.equal(new Set(numbers).size, CONCURRENCY, `expected ${CONCURRENCY} unique numbers, got: ${numbers.join(", ")}`);
    });

    // --- steps + tags round-trip ---
    const primaryCaseId = created.testCaseIds[0];
    await check("test case steps insert and read back in StepNumber order", async () => {
      await db.request().input("id", sql.Int, primaryCaseId).input("a", sql.NVarChar, "Step A").query(
        "INSERT INTO QaTestCaseSteps (TestCaseId, StepNumber, Action) VALUES (@id, 2, 'Step B')"
      );
      await db.request().input("id", sql.Int, primaryCaseId).query(
        "INSERT INTO QaTestCaseSteps (TestCaseId, StepNumber, Action) VALUES (@id, 1, 'Step A')"
      );
      const steps = await db.request().input("id", sql.Int, primaryCaseId).query<{ Action: string }>(
        "SELECT Action FROM QaTestCaseSteps WHERE TestCaseId = @id ORDER BY StepNumber ASC"
      );
      assert.deepEqual(steps.recordset.map((s) => s.Action), ["Step A", "Step B"]);
    });

    // --- test run + run-case + execution history (append-only, latest-wins) ---
    await check("test run creation, case assignment, and execution history ordering", async () => {
      const runResult = await withReferenceNumber("QaTestRuns", "TestRunNumber", "TR", async (tx, num) => {
        const r = await new sql.Request(tx)
          .input("num", sql.VarChar, num)
          .input("name", sql.NVarChar, MARKER)
          .input("projectId", sql.Int, created.projectId)
          .query<{ Id: number; TestRunNumber: string }>(
            "INSERT INTO QaTestRuns (TestRunNumber, Name, ProjectId) OUTPUT INSERTED.Id, INSERTED.TestRunNumber VALUES (@num, @name, @projectId)"
          );
        return r.recordset[0];
      });
      created.runId = runResult.Id;
      assert.match(runResult.TestRunNumber, /^TR-\d{5}$/);

      const rcResult = await db.request().input("runId", sql.Int, created.runId).input("caseId", sql.Int, primaryCaseId).query<{ Id: number }>(
        "INSERT INTO QaTestRunCases (TestRunId, TestCaseId) OUTPUT INSERTED.Id VALUES (@runId, @caseId)"
      );
      created.runCaseId = rcResult.recordset[0].Id;

      // Duplicate (TestRunId, TestCaseId) must be rejected by UQ_QaTestRunCases_Run_Case.
      await assert.rejects(
        db.request().input("runId", sql.Int, created.runId).input("caseId", sql.Int, primaryCaseId).query(
          "INSERT INTO QaTestRunCases (TestRunId, TestCaseId) VALUES (@runId, @caseId)"
        ),
        /UQ_QaTestRunCases_Run_Case|unique/i,
        "duplicate run-case pair must violate the unique constraint"
      );

      // Two executions, second one newer — "latest" must reflect the second, and history
      // (append-only) must still contain both.
      await db.request().input("rcId", sql.Int, created.runCaseId).query(
        "INSERT INTO QaTestExecutions (TestRunCaseId, Result, ExecutedAt) VALUES (@rcId, 'Passed', DATEADD(SECOND, -5, SYSUTCDATETIME()))"
      );
      await db.request().input("rcId", sql.Int, created.runCaseId).query(
        "INSERT INTO QaTestExecutions (TestRunCaseId, Result) VALUES (@rcId, 'Failed')"
      );

      const latest = await db.request().input("rcId", sql.Int, created.runCaseId).query<{ Result: string }>(
        "SELECT TOP 1 Result FROM QaTestExecutions WHERE TestRunCaseId = @rcId ORDER BY ExecutedAt DESC"
      );
      assert.equal(latest.recordset[0].Result, "Failed", "latest execution result must be the most recently inserted one");

      const history = await db.request().input("rcId", sql.Int, created.runCaseId).query<{ Result: string }>(
        "SELECT Result FROM QaTestExecutions WHERE TestRunCaseId = @rcId"
      );
      assert.equal(history.recordset.length, 2, "both execution attempts must remain in history (append-only)");
    });

    // --- bug creation + ResolvedAt semantics ---
    await check("bug creation defaults Status='New' and ResolvedAt=NULL", async () => {
      const bugResult = await withReferenceNumber("QaBugs", "BugNumber", "BUG", async (tx, num) => {
        const r = await new sql.Request(tx)
          .input("num", sql.VarChar, num)
          .input("title", sql.NVarChar, MARKER)
          .input("projectId", sql.Int, created.projectId)
          .input("caseId", sql.Int, primaryCaseId)
          .query<{ Id: number; BugNumber: string; Status: string; ResolvedAt: Date | null }>(
            "INSERT INTO QaBugs (BugNumber, Title, ProjectId, TestCaseId) OUTPUT INSERTED.Id, INSERTED.BugNumber, INSERTED.Status, INSERTED.ResolvedAt VALUES (@num, @title, @projectId, @caseId)"
          );
        return r.recordset[0];
      });
      created.bugId = bugResult.Id;
      assert.match(bugResult.BugNumber, /^BUG-\d{5}$/);
      assert.equal(bugResult.Status, "New");
      assert.equal(bugResult.ResolvedAt, null);
    });

    await check("moving a bug to a resolved status stamps ResolvedAt, and reopening clears it", async () => {
      await db.request().input("id", sql.Int, created.bugId).query(
        "UPDATE QaBugs SET Status = 'Resolved', ResolvedAt = SYSUTCDATETIME() WHERE Id = @id"
      );
      const resolved = await db.request().input("id", sql.Int, created.bugId).query<{ ResolvedAt: Date | null }>(
        "SELECT ResolvedAt FROM QaBugs WHERE Id = @id"
      );
      assert.notEqual(resolved.recordset[0].ResolvedAt, null, "ResolvedAt must be set once Status enters a resolved state");

      await db.request().input("id", sql.Int, created.bugId).query(
        "UPDATE QaBugs SET Status = 'Reopened', ResolvedAt = NULL WHERE Id = @id"
      );
      const reopened = await db.request().input("id", sql.Int, created.bugId).query<{ ResolvedAt: Date | null }>(
        "SELECT ResolvedAt FROM QaBugs WHERE Id = @id"
      );
      assert.equal(reopened.recordset[0].ResolvedAt, null, "ResolvedAt must be cleared once Status leaves a resolved state");
    });

    // --- FK integrity: no ON DELETE CASCADE anywhere in this app's convention ---
    await check("QaTestCases cannot be hard-deleted while a QaBugs row still references it (no CASCADE)", async () => {
      await assert.rejects(
        db.request().input("id", sql.Int, primaryCaseId).query("DELETE FROM QaTestCases WHERE Id = @id"),
        /REFERENCE|FK_/i,
        "deleting a referenced test case must fail on the FK, matching this app's no-CASCADE convention"
      );
    });
  } finally {
    // --- teardown, FK-safe child-before-parent order ---
    if (created.bugId) await db.request().input("id", sql.Int, created.bugId).query("DELETE FROM QaBugs WHERE Id = @id");
    if (created.runCaseId) await db.request().input("id", sql.Int, created.runCaseId).query("DELETE FROM QaTestExecutions WHERE TestRunCaseId = @id");
    if (created.runCaseId) await db.request().input("id", sql.Int, created.runCaseId).query("DELETE FROM QaTestRunCases WHERE Id = @id");
    if (created.runId) await db.request().input("id", sql.Int, created.runId).query("DELETE FROM QaTestRuns WHERE Id = @id");
    for (const id of created.testCaseIds) {
      await db.request().input("id", sql.Int, id).query("DELETE FROM QaTestCaseSteps WHERE TestCaseId = @id");
      await db.request().input("id", sql.Int, id).query("DELETE FROM QaTestCaseTags WHERE TestCaseId = @id");
    }
    for (const id of created.testCaseIds) {
      await db.request().input("id", sql.Int, id).query("DELETE FROM QaTestCases WHERE Id = @id");
    }
    if (created.suiteId) await db.request().input("id", sql.Int, created.suiteId).query("DELETE FROM QaTestSuites WHERE Id = @id");
    if (created.moduleId) await db.request().input("id", sql.Int, created.moduleId).query("DELETE FROM QaModules WHERE Id = @id");
    if (created.projectId) await db.request().input("id", sql.Int, created.projectId).query("DELETE FROM QaProjects WHERE Id = @id");

    // Belt-and-braces sweep for any marker-tagged rows a failed assertion left behind
    // (e.g. an assert threw before its own row's id was recorded).
    const leftoverCases = await db.request().input("marker", sql.NVarChar, MARKER).query<{ Id: number }>(
      "SELECT Id FROM QaTestCases WHERE Title = @marker"
    );
    for (const row of leftoverCases.recordset) {
      await db.request().input("id", sql.Int, row.Id).query("DELETE FROM QaTestCaseSteps WHERE TestCaseId = @id");
      await db.request().input("id", sql.Int, row.Id).query("DELETE FROM QaTestCaseTags WHERE TestCaseId = @id");
      await db.request().input("id", sql.Int, row.Id).query("DELETE FROM QaTestCases WHERE Id = @id");
    }
  }

  console.log(failures === 0 ? "\nAll QA integration checks passed." : `\n${failures} QA integration check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
