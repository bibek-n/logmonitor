import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AdminAuditLog' AND xtype='U')
    CREATE TABLE AdminAuditLog (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      UserId INT NULL,
      Username NVARCHAR(100) NOT NULL,
      Section NVARCHAR(100) NOT NULL,
      Action NVARCHAR(100) NOT NULL,
      Details NVARCHAR(MAX) NULL,
      IpAddress NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_AdminAuditLog_CreatedAt')
    CREATE INDEX IX_AdminAuditLog_CreatedAt ON AdminAuditLog (CreatedAt DESC)
  `;

  console.log("AdminAuditLog table ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
