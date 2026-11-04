import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();
  await db.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ReportTemplates')
    BEGIN
      CREATE TABLE ReportTemplates (
        Id INT IDENTITY PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        SourceKey VARCHAR(50) NOT NULL,
        SelectedColumnsJson NVARCHAR(1000) NOT NULL,
        Days INT NULL,
        CreatedByUserId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      )
    END
  `);
  console.log("ReportTemplates table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
