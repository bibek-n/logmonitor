import "dotenv/config";
import { getDb, sql } from "../src/lib/db";

// Replaces the free-text QaTestRuns.RunType (New Feature / Regression / Smoke / Full
// Regression, added in the previous workflow-gates migration) with a proper lookup table +
// many-to-many link to test cases, matching the "select a run type, auto-load matching test
// cases" design: a test case can belong to multiple run types (Smoke, Regression, Release,
// Security, Browser Compatibility, Mobile, Production Verification, Custom), and creating a
// test run of a given type pre-filters the test-case picker to just that type's cases.
//
// The old QaTestRuns.RunType column is left in place (unused by application code from this
// point on) rather than dropped — this app never does destructive schema changes, and the
// column is harmless dead weight, not a risk. New code reads/writes RunTypeId only.

const DEFAULT_RUN_TYPES: { name: string; description: string }[] = [
  { name: "Smoke Test", description: "Validates critical application functionality after deployment." },
  { name: "Regression Test", description: "Checks that existing functionality still works after changes." },
  { name: "Release Test", description: "Validates the complete application before production release." },
  { name: "Security Test", description: "Checks authentication, authorization, input validation, and security controls." },
  { name: "Browser Compatibility Test", description: "Checks application behavior across supported browsers." },
  { name: "Mobile Test", description: "Checks responsive layout and functionality on mobile devices." },
  { name: "Production Verification Test", description: "Runs critical validation checks after production deployment." },
  { name: "Custom Test", description: "Manually select test cases regardless of their assigned run types." },
];

// Best-effort mapping so the one existing test run (seeded from the Build Up Nepal QA pass)
// doesn't end up with a NULL RunTypeId once the column goes NOT NULL.
const LEGACY_RUN_TYPE_MAP: Record<string, string> = {
  Smoke: "Smoke Test",
  Regression: "Regression Test",
  "Full Regression": "Regression Test",
  "New Feature": "Custom Test",
};

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaTestRunTypes' AND xtype='U')
    CREATE TABLE QaTestRunTypes (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL UNIQUE,
      Description NVARCHAR(500) NULL,
      IsActive BIT NOT NULL DEFAULT 1,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  console.log("QaTestRunTypes table ready.");

  for (const rt of DEFAULT_RUN_TYPES) {
    const existing = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM QaTestRunTypes WHERE Name = ${rt.name}`;
    if (existing.recordset[0].Cnt === 0) {
      await db.query`INSERT INTO QaTestRunTypes (Name, Description) VALUES (${rt.name}, ${rt.description})`;
      console.log(`  seeded: ${rt.name}`);
    }
  }

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='QaTestCaseRunTypes' AND xtype='U')
    CREATE TABLE QaTestCaseRunTypes (
      TestCaseId INT NOT NULL,
      RunTypeId INT NOT NULL,
      CONSTRAINT PK_QaTestCaseRunTypes PRIMARY KEY (TestCaseId, RunTypeId),
      CONSTRAINT FK_QaTestCaseRunTypes_QaTestCases FOREIGN KEY (TestCaseId) REFERENCES QaTestCases(Id),
      CONSTRAINT FK_QaTestCaseRunTypes_QaTestRunTypes FOREIGN KEY (RunTypeId) REFERENCES QaTestRunTypes(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaTestCaseRunTypes_RunTypeId')
    CREATE INDEX IX_QaTestCaseRunTypes_RunTypeId ON QaTestCaseRunTypes (RunTypeId)
  `;
  console.log("QaTestCaseRunTypes junction table ready.");

  const hasRunTypeId = await db.query<{ Cnt: number }>`
    SELECT COUNT(*) AS Cnt FROM sys.columns WHERE object_id = OBJECT_ID('QaTestRuns') AND name = 'RunTypeId'
  `;
  if (hasRunTypeId.recordset[0].Cnt === 0) {
    await db.query`ALTER TABLE QaTestRuns ADD RunTypeId INT NULL`;
    console.log("Added QaTestRuns.RunTypeId (nullable, backfilling next).");

    const legacyRuns = await db.query<{ Id: number; RunType: string | null }>`SELECT Id, RunType FROM QaTestRuns WHERE RunTypeId IS NULL`;
    for (const run of legacyRuns.recordset) {
      const mappedName = (run.RunType && LEGACY_RUN_TYPE_MAP[run.RunType]) || "Custom Test";
      const typeRow = await db.query<{ Id: number }>`SELECT Id FROM QaTestRunTypes WHERE Name = ${mappedName}`;
      const runTypeId = typeRow.recordset[0]?.Id;
      if (runTypeId) {
        await db
          .request()
          .input("id", sql.Int, run.Id)
          .input("runTypeId", sql.Int, runTypeId)
          .query("UPDATE QaTestRuns SET RunTypeId = @runTypeId WHERE Id = @id");
        console.log(`  backfilled run ${run.Id}: '${run.RunType}' -> '${mappedName}'`);
      }
    }

    await db.query`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_QaTestRuns_RunTypeId')
      CREATE INDEX IX_QaTestRuns_RunTypeId ON QaTestRuns (RunTypeId)
    `;
  } else {
    console.log("QaTestRuns.RunTypeId already exists — skipping.");
  }

  console.log("Test run types migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
