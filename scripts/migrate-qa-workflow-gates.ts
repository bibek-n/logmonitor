import "dotenv/config";
import { getDb } from "../src/lib/db";

// Aligns the QA Testing Management schema with the full requirement -> release workflow:
//
//   Requirement Received -> Create Test Suite -> Write Test Cases -> Review Test Cases ->
//   Create Test Run -> Deploy Application to QA -> Execute Tests -> Pass/Fail ->
//   (Fail: Create Bug -> Developer Fix -> Retest) -> Regression Testing -> QA Reports ->
//   QA Approval -> Production Release
//
// Everything from "Create Test Suite" through "Retest" already existed (Phase 3/4). This
// migration adds the columns needed for the steps that didn't have anywhere to live yet:
// requirement traceability, an explicit review gate (distinct from the Status enum), the
// QA-deployment event, run-type (so a Regression run is a first-class distinction from a
// first-pass run), and the QA-approval / release sign-off gates.
//
// All ALTER TABLE ... ADD statements are guarded by IF NOT EXISTS on sys.columns, so this is
// safe to re-run.

// table/column/definition are always literal constants passed by this script, never user
// input, so string-interpolating them into DDL text is safe — same trust boundary every
// migrate-*.ts script in this app already relies on for table/column identifiers (SQL has no
// way to parameterize a DDL identifier anyway).
async function addColumnIfMissing(
  db: Awaited<ReturnType<typeof getDb>>,
  table: string,
  column: string,
  definition: string
) {
  const check = await db
    .request()
    .input("table", table)
    .input("column", column)
    .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM sys.columns WHERE object_id = OBJECT_ID(@table) AND name = @column");
  if (check.recordset[0].Cnt > 0) {
    console.log(`  skip ${table}.${column} (already exists)`);
    return;
  }
  await db.request().query(`ALTER TABLE ${table} ADD ${column} ${definition}`);
  console.log(`  added ${table}.${column}`);
}

async function main() {
  const db = await getDb();

  console.log("QaTestSuites — requirement traceability:");
  await addColumnIfMissing(db, "QaTestSuites", "RequirementRef", "NVARCHAR(200) NULL");

  console.log("QaTestCases — explicit review gate:");
  await addColumnIfMissing(db, "QaTestCases", "ReviewedByUserId", "INT NULL");
  await addColumnIfMissing(db, "QaTestCases", "ReviewedAt", "DATETIME2 NULL");

  console.log("QaTestRuns — run type, QA deployment, QA approval:");
  await addColumnIfMissing(db, "QaTestRuns", "RunType", "VARCHAR(20) NOT NULL CONSTRAINT DF_QaTestRuns_RunType DEFAULT 'New Feature'");
  await addColumnIfMissing(db, "QaTestRuns", "DeployedBuildVersion", "NVARCHAR(50) NULL");
  await addColumnIfMissing(db, "QaTestRuns", "DeployedAt", "DATETIME2 NULL");
  await addColumnIfMissing(db, "QaTestRuns", "QaApprovedByUserId", "INT NULL");
  await addColumnIfMissing(db, "QaTestRuns", "QaApprovedAt", "DATETIME2 NULL");

  console.log("QaReleases — production release sign-off:");
  await addColumnIfMissing(db, "QaReleases", "ReleasedByUserId", "INT NULL");
  await addColumnIfMissing(db, "QaReleases", "ReleasedAt", "DATETIME2 NULL");

  console.log("Workflow-gate columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
