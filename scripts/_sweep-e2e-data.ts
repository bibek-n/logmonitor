import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

const MARKER = "__qa_e2e__%";

async function main() {
  const db = await getDb();

  const bugs = await db.request().input("m", sql.NVarChar, MARKER).query<{ Id: number }>("SELECT Id FROM QaBugs WHERE Title LIKE @m");
  for (const b of bugs.recordset) {
    await db.request().input("id", sql.Int, b.Id).query("DELETE FROM QaAttachments WHERE EntityType = 'Bug' AND EntityId = @id");
    await db.request().input("id", sql.Int, b.Id).query("DELETE FROM QaBugs WHERE Id = @id");
  }

  const runs = await db.request().input("m", sql.NVarChar, MARKER).query<{ Id: number }>("SELECT Id FROM QaTestRuns WHERE Name LIKE @m");
  for (const r of runs.recordset) {
    const rcs = await db.request().input("runId", sql.Int, r.Id).query<{ Id: number }>("SELECT Id FROM QaTestRunCases WHERE TestRunId = @runId");
    for (const rc of rcs.recordset) {
      await db.request().input("id", sql.Int, rc.Id).query("DELETE FROM QaTestExecutions WHERE TestRunCaseId = @id");
    }
    await db.request().input("runId", sql.Int, r.Id).query("DELETE FROM QaTestRunCases WHERE TestRunId = @runId");
    await db.request().input("id", sql.Int, r.Id).query("DELETE FROM QaTestRuns WHERE Id = @id");
  }

  const cases = await db.request().input("m", sql.NVarChar, MARKER).query<{ Id: number }>("SELECT Id FROM QaTestCases WHERE Title LIKE @m");
  for (const c of cases.recordset) {
    await db.request().input("id", sql.Int, c.Id).query("DELETE FROM QaAttachments WHERE EntityType = 'TestCase' AND EntityId = @id");
    await db.request().input("id", sql.Int, c.Id).query("DELETE FROM QaTestCaseSteps WHERE TestCaseId = @id");
    await db.request().input("id", sql.Int, c.Id).query("DELETE FROM QaTestCaseTags WHERE TestCaseId = @id");
    await db.request().input("id", sql.Int, c.Id).query("DELETE FROM QaTestCases WHERE Id = @id");
  }

  const suites = await db.request().input("m", sql.NVarChar, MARKER).query<{ Id: number }>("SELECT Id FROM QaTestSuites WHERE Name LIKE @m");
  for (const s of suites.recordset) {
    await db.request().input("id", sql.Int, s.Id).query("DELETE FROM QaTestSuites WHERE Id = @id");
  }

  const modules = await db.request().input("m", sql.NVarChar, MARKER).query<{ Id: number }>("SELECT Id FROM QaModules WHERE Name LIKE @m");
  for (const mo of modules.recordset) {
    await db.request().input("id", sql.Int, mo.Id).query("DELETE FROM QaModules WHERE Id = @id");
  }

  const releases = await db.request().input("m", sql.NVarChar, MARKER).query<{ Id: number }>("SELECT Id FROM QaReleases WHERE Name LIKE @m");
  for (const rel of releases.recordset) {
    await db.request().input("id", sql.Int, rel.Id).query("DELETE FROM QaReleases WHERE Id = @id");
  }

  const projects = await db.request().input("m", sql.NVarChar, MARKER).query<{ Id: number }>("SELECT Id FROM QaProjects WHERE Name LIKE @m");
  for (const p of projects.recordset) {
    await db.request().input("id", sql.Int, p.Id).query("DELETE FROM QaProjects WHERE Id = @id");
  }

  const activity = await db.request().query("DELETE FROM QaActivityLogs WHERE PreviousValue LIKE '%__qa_e2e__%' OR NewValue LIKE '%__qa_e2e__%'");

  console.log(`Swept: ${bugs.recordset.length} bugs, ${runs.recordset.length} runs, ${cases.recordset.length} cases, ${suites.recordset.length} suites, ${modules.recordset.length} modules, ${releases.recordset.length} releases, ${projects.recordset.length} projects, ${activity.rowsAffected[0]} activity log rows.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
