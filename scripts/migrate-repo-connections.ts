import "dotenv/config";
import { getDb } from "../src/lib/db";

// Shared, module-agnostic Git repository connections - the "universal" counterpart to
// CodeQualityGitHubConnections/CodeQualityGitLabConnections. Any module that needs to sync a
// project from a GitHub or GitLab repo (Code Quality, Laravel Security, and future modules)
// references a row here via RepoConnectionId, instead of every module owning its own
// duplicate connection table. Provider distinguishes GitHub vs GitLab; AuthMethod covers all
// three GitHub methods plus GitLab's PAT-only method (GitLab rows only ever use 'PAT',
// enforced at the application layer - the CHECK stays permissive across both providers to
// keep the schema simple).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RepoConnections' AND xtype='U')
    CREATE TABLE RepoConnections (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Provider VARCHAR(20) NOT NULL,
      Name NVARCHAR(200) NOT NULL,
      AuthMethod VARCHAR(20) NOT NULL,
      InstanceUrl NVARCHAR(500) NULL,
      OwnerLogin NVARCHAR(200) NULL,
      AccessTokenEncrypted NVARCHAR(MAX) NULL,
      RefreshTokenEncrypted NVARCHAR(MAX) NULL,
      TokenExpiresAt DATETIME2 NULL,
      InstallationId BIGINT NULL,
      ScopesGranted NVARCHAR(500) NULL,
      CreatedByUserId INT NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DeletedAt DATETIME2 NULL,
      CONSTRAINT FK_RepoConnections_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id),
      CONSTRAINT CK_RepoConnections_Provider CHECK (Provider IN ('GitHub', 'GitLab')),
      CONSTRAINT CK_RepoConnections_AuthMethod CHECK (AuthMethod IN ('PAT', 'OAuthApp', 'GitHubApp'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RepoConnections_DeletedAt')
    CREATE INDEX IX_RepoConnections_DeletedAt ON RepoConnections (DeletedAt)
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_RepoConnections_Provider')
    CREATE INDEX IX_RepoConnections_Provider ON RepoConnections (Provider)
  `;

  // One-time data migration from the two module-specific tables, only if they exist and this
  // hasn't already run (guarded by checking RepoConnections is still empty - safe to re-run
  // this whole script any number of times).
  const existingCount = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM RepoConnections`;
  if (existingCount.recordset[0].Cnt === 0) {
    const githubTableExists = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM sysobjects WHERE name='CodeQualityGitHubConnections' AND xtype='U'`;
    if (githubTableExists.recordset[0].Cnt > 0) {
      await db.query`
        INSERT INTO RepoConnections (Provider, Name, AuthMethod, OwnerLogin, AccessTokenEncrypted, RefreshTokenEncrypted, TokenExpiresAt, InstallationId, ScopesGranted, CreatedByUserId, CreatedAt, UpdatedAt, DeletedAt)
        SELECT 'GitHub', Name, AuthMethod, OwnerLogin, AccessTokenEncrypted, RefreshTokenEncrypted, TokenExpiresAt, InstallationId, ScopesGranted, CreatedByUserId, CreatedAt, UpdatedAt, DeletedAt
        FROM CodeQualityGitHubConnections
      `;
    }
    const gitlabTableExists = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM sysobjects WHERE name='CodeQualityGitLabConnections' AND xtype='U'`;
    if (gitlabTableExists.recordset[0].Cnt > 0) {
      await db.query`
        INSERT INTO RepoConnections (Provider, Name, AuthMethod, InstanceUrl, OwnerLogin, AccessTokenEncrypted, CreatedByUserId, CreatedAt, UpdatedAt, DeletedAt)
        SELECT 'GitLab', Name, 'PAT', InstanceUrl, OwnerLogin, AccessTokenEncrypted, CreatedByUserId, CreatedAt, UpdatedAt, DeletedAt
        FROM CodeQualityGitLabConnections
      `;
    }
  }

  // CodeQualityProjects gets a generic pointer alongside its old provider-specific ones. The
  // old GitHubConnectionId/GitLabConnectionId columns are intentionally left in place (not
  // dropped) - safer than a destructive column drop, and nothing reads them once
  // projects/route.ts and runScan.ts are updated to use RepoConnectionId/RepoProvider instead.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualityProjects') AND name = 'RepoConnectionId')
    ALTER TABLE CodeQualityProjects ADD RepoConnectionId INT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualityProjects') AND name = 'RepoProvider')
    ALTER TABLE CodeQualityProjects ADD RepoProvider VARCHAR(20) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CodeQualityProjects_RepoConnection')
    ALTER TABLE CodeQualityProjects
      ADD CONSTRAINT FK_CodeQualityProjects_RepoConnection FOREIGN KEY (RepoConnectionId)
      REFERENCES RepoConnections(Id) ON DELETE SET NULL
  `;

  // Backfill RepoConnectionId/RepoProvider for any existing CodeQuality projects that still
  // only have the old GitHubConnectionId/GitLabConnectionId set, by matching on the migrated
  // connection's original name+owner (best-effort - only matters if projects were created
  // before this migration ran).
  await db.query`
    UPDATE p SET p.RepoConnectionId = rc.Id, p.RepoProvider = 'GitHub'
    FROM CodeQualityProjects p
    JOIN CodeQualityGitHubConnections ghc ON ghc.Id = p.GitHubConnectionId
    JOIN RepoConnections rc ON rc.Provider = 'GitHub' AND rc.Name = ghc.Name AND rc.CreatedByUserId = ghc.CreatedByUserId AND rc.CreatedAt = ghc.CreatedAt
    WHERE p.GitHubConnectionId IS NOT NULL AND p.RepoConnectionId IS NULL
  `;
  await db.query`
    UPDATE p SET p.RepoConnectionId = rc.Id, p.RepoProvider = 'GitLab'
    FROM CodeQualityProjects p
    JOIN CodeQualityGitLabConnections glc ON glc.Id = p.GitLabConnectionId
    JOIN RepoConnections rc ON rc.Provider = 'GitLab' AND rc.Name = glc.Name AND rc.CreatedByUserId = glc.CreatedByUserId AND rc.CreatedAt = glc.CreatedAt
    WHERE p.GitLabConnectionId IS NOT NULL AND p.RepoConnectionId IS NULL
  `;

  console.log("Shared repo connections migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
