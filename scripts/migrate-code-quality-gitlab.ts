import "dotenv/config";
import { getDb } from "../src/lib/db";

// GitLab repository connections for the Code Quality module - the GitLab counterpart to
// migrate-code-quality-github.ts. PAT-only (no OAuth Application flow), so this table is
// simpler than CodeQualityGitHubConnections: no InstallationId, no RefreshTokenEncrypted, no
// TokenExpiresAt. InstanceUrl is required (a self-hosted GitLab base URL, e.g.
// "https://gitlab.example.com") since - unlike GitHub - there's no single fixed host.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CodeQualityGitLabConnections' AND xtype='U')
    CREATE TABLE CodeQualityGitLabConnections (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      InstanceUrl NVARCHAR(500) NOT NULL,
      OwnerLogin NVARCHAR(200) NULL,
      AccessTokenEncrypted NVARCHAR(MAX) NOT NULL,
      CreatedByUserId INT NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      DeletedAt DATETIME2 NULL,
      CONSTRAINT FK_CodeQualityGitLabConnections_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_CodeQualityGitLabConnections_DeletedAt')
    CREATE INDEX IX_CodeQualityGitLabConnections_DeletedAt ON CodeQualityGitLabConnections (DeletedAt)
  `;

  // GitLabConnectionId is a sibling of the existing GitHubConnectionId column, not a
  // replacement - a project is synced from at most one of the two, sharing the same
  // RepositoryOwner/RepositoryName/RepositoryRef/LastSyncedCommitSha/LastSyncedAt columns
  // migrate-code-quality-github.ts already added.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('CodeQualityProjects') AND name = 'GitLabConnectionId')
    ALTER TABLE CodeQualityProjects ADD GitLabConnectionId INT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CodeQualityProjects_GitLabConnection')
    ALTER TABLE CodeQualityProjects
      ADD CONSTRAINT FK_CodeQualityProjects_GitLabConnection FOREIGN KEY (GitLabConnectionId)
      REFERENCES CodeQualityGitLabConnections(Id) ON DELETE SET NULL
  `;

  console.log("Code Quality GitLab connections migration complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
