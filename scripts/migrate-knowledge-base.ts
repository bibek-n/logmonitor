import "dotenv/config";
import { getDb } from "../src/lib/db";

// Idempotent - safe to run more than once. One table: a flat document library (title,
// description, category, tags, the uploaded file) for IT/config/troubleshooting docs so a new
// hire can read what a departing staff member knew. No versioning/history table for v1 -
// replacing a file on an existing row just overwrites FilePath/OriginalFileName/etc.
async function main() {
  const db = await getDb();

  const existing = await db.query<{ Cnt: number }>(
    "SELECT COUNT(*) AS Cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'KnowledgeBaseDocuments'"
  );
  if (existing.recordset[0].Cnt > 0) {
    console.log("KnowledgeBaseDocuments already exists - nothing to do.");
    process.exit(0);
  }

  await db.query(`
    CREATE TABLE KnowledgeBaseDocuments (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Title NVARCHAR(200) NOT NULL,
      Description NVARCHAR(2000) NULL,
      Category VARCHAR(50) NOT NULL,
      Tags NVARCHAR(300) NULL,
      FilePath NVARCHAR(500) NOT NULL,
      OriginalFileName NVARCHAR(255) NOT NULL,
      ContentType NVARCHAR(150) NULL,
      SizeBytes INT NOT NULL,
      UploadedByUserId INT NULL,
      UploadedByName NVARCHAR(100) NULL,
      CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_KnowledgeBaseDocuments_CreatedAt DEFAULT (SYSUTCDATETIME()),
      UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_KnowledgeBaseDocuments_UpdatedAt DEFAULT (SYSUTCDATETIME())
    )
  `);
  await db.query("CREATE INDEX IX_KnowledgeBaseDocuments_Category ON KnowledgeBaseDocuments (Category)");
  await db.query("CREATE INDEX IX_KnowledgeBaseDocuments_CreatedAt ON KnowledgeBaseDocuments (CreatedAt DESC)");

  console.log("Created KnowledgeBaseDocuments (+ 2 indexes).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
