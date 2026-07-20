import "dotenv/config";
import { getDb } from "../src/lib/db";

// A brand-new, independent table for the "Design New Diagram" designer — deliberately
// separate from the legacy single-row `NetworkDiagrams` table (scripts/migrate-network-diagram.ts,
// Id = 1 only, no name/owner/status columns, no per-diagram id). That table's schema cannot
// support multiple independently named/owned diagrams, so this is a new table rather than a
// reuse — nothing in this migration touches, reads, or writes `NetworkDiagrams` in any way.
//
// Unlike the legacy table, ISJSON is enforced from the start here: this table starts empty,
// so there's no pre-existing-data risk (the app-level zod validation in
// src/lib/networkDiagramDesigner/schema.ts is the primary gate; this is defense in depth).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NetworkDiagramDesigns' AND xtype='U')
    CREATE TABLE NetworkDiagramDesigns (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Description NVARCHAR(1000) NULL,
      DiagramJson NVARCHAR(MAX) NOT NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'Draft',
      OwnerUserId INT NOT NULL,
      CreatedByUserId INT NOT NULL,
      UpdatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DeletedAt DATETIME2 NULL,
      CONSTRAINT FK_NetworkDiagramDesigns_Owner FOREIGN KEY (OwnerUserId) REFERENCES Users(Id),
      CONSTRAINT FK_NetworkDiagramDesigns_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
      CONSTRAINT CK_NetworkDiagramDesigns_DiagramJson_IsJson CHECK (ISJSON(DiagramJson) = 1)
    )
  `;
  console.log("NetworkDiagramDesigns table ready.");

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_NetworkDiagramDesigns_OwnerUserId')
    CREATE INDEX IX_NetworkDiagramDesigns_OwnerUserId ON NetworkDiagramDesigns (OwnerUserId)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_NetworkDiagramDesigns_Status')
    CREATE INDEX IX_NetworkDiagramDesigns_Status ON NetworkDiagramDesigns (Status)
  `;
  console.log("NetworkDiagramDesigns indexes ready.");

  console.log("Network diagram designs migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
